'use strict';
/*
 * Tashqi manbalardan master `journals` jadvalini AVTOMATIK yangilash.
 *
 * Manbalar (har biri env bilan almashtiriladi yoki 'off' bilan o'chiriladi):
 *   scimago       SCOPUS_FEED_URL            SCImago "Journal Rankings" CSV  -> kvartillar (jurnal Scopus'da faol)
 *   discontinued  SCOPUS_DISCONTINUED_URL    OAK saytidagi "Scopus'dan chiqarilgan jurnallar" .xlsx -> scopus_status=discontinued
 *   oak           OAK_FEED_URL               ixtiyoriy: OAK ro'yxati (CSV/JSON)  (standart manba yo'q)
 * FEEDS_AUTO=0 — barcha avtomatik yuklashni o'chiradi. FEED_TTL_HOURS — takroriy yuklash oralig'i (standart 168 = haftasiga).
 * Yuklash: Cloudflare Cron Trigger (haftalik), foydalanuvchi Refresh bosganda (TTL bo'yicha) yoki admin tugmasi bilan.
 * Qo'lda yuklash (admin → Fid / import) ham saqlangan.
 */
const { changeStmt } = require('./recommend');
const { getSetting, setSetting, batchChunked } = require('./db');
const { parseXlsx } = require('./xlsx');

const SOURCES = {
  scimago: { source: 'scopus', env: 'SCOPUS_FEED_URL', url: 'https://www.scimagojr.com/journalrank.php?out=xls', label: 'SCImago (Scopus kvartillari)' },
  discontinued: { source: 'scopus', env: 'SCOPUS_DISCONTINUED_URL', url: 'https://oak.uz/userfiles/files/2%20Discontinued-sources-from-Scopus-January_2026.xlsx', label: "Scopus'dan chiqarilgan jurnallar (OAK)" },
  oak: { source: 'oak', env: 'OAK_FEED_URL', url: null, label: "OAK ro'yxati" },
};

function sourceUrl(key, env = process.env) {
  if (env.FEEDS_AUTO === '0') return null;
  const s = SOURCES[key];
  const v = env[s.env];
  if (v && /^off$/i.test(v.trim())) return null;
  return (v && v.trim()) || s.url;
}

// ---------------- CSV ----------------
function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delim = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

const clean = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9а-яё]+/g, ' ').trim();
const normIssn = (s) => String(s || '').replace(/[^0-9xX]/g, '').toUpperCase();
const issnList = (s) => String(s || '').split(/[,;\s/]+/).map(normIssn).filter((x) => x.length === 8);

/** Turli format yozuvlarini yagona ko'rinishga keltiradi */
function normalizeItem(r) {
  const get = (...keys) => { for (const k of keys) if (r[k] != null && r[k] !== '') return r[k]; return ''; };
  const q = String(get('quartile', 'sjr best quartile', 'best quartile', 'q')).toUpperCase();
  const issns = issnList([get('issn', 'issn_print'), get('eissn', 'e-issn')].join(','));
  return {
    name: String(get('name', 'title', 'sourcetitle', 'source title')).trim(),
    issn: issns[0] || '', issns,
    quartile: /^Q[1-4]$/.test(q) ? q : '',
    scopus_status: get('scopus_status'),
    oak_status: get('oak_status'),
    publisher: get('publisher'),
    subjects: get('subjects'),
    access: get('access'),
  };
}

function parseFeed(text) {
  const t = text.trim();
  if (t.startsWith('[') || t.startsWith('{')) {
    const j = JSON.parse(t);
    return (Array.isArray(j) ? j : j.items || []).map(normalizeItem);
  }
  return parseCsv(t).map(normalizeItem);
}

function splitLine(line, delim) {
  if (!line.includes('"')) return line.split(delim);
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === delim) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * SCImago CSV (~30 ming qator) ichidan faqat BIZ BAZADA BOR jurnallarni ajratib oladi (tez, xotirani tejaydi).
 * Ustunlar: Title, Issn, "SJR Best Quartile" (nuqtali vergul bilan ajratilgan).
 */
function scanScimago(text, wantedNames, wantedIssns) {
  const nl = text.indexOf('\n');
  if (nl < 0) throw new Error("SCImago CSV bo'sh");
  const header = text.slice(0, nl).replace(/\r$/, '');
  const delim = (header.match(/;/g) || []).length >= (header.match(/,/g) || []).length ? ';' : ',';
  const cols = splitLine(header, delim).map((h) => h.trim().toLowerCase().replace(/^﻿/, ''));
  const iTitle = cols.indexOf('title'), iIssn = cols.indexOf('issn'), iQ = cols.findIndex((c) => c === 'sjr best quartile' || c === 'best quartile');
  if (iTitle < 0 || iIssn < 0 || iQ < 0) throw new Error(`SCImago CSV ustunlari topilmadi (Title / Issn / SJR Best Quartile). Topilgan: ${cols.slice(0, 8).join(', ')}`);
  const items = []; let rows = 0;
  let pos = nl + 1;
  while (pos < text.length) {
    let end = text.indexOf('\n', pos); if (end < 0) end = text.length;
    const line = text.slice(pos, end).replace(/\r$/, '');
    pos = end + 1;
    if (!line) continue;
    rows++;
    const f = splitLine(line, delim);
    const issns = issnList(f[iIssn]);
    const title = (f[iTitle] || '').trim();
    if (wantedNames.has(clean(title)) || issns.some((i) => wantedIssns.has(i))) {
      const q = String(f[iQ] || '').trim().toUpperCase();
      items.push({ name: title, issn: issns[0] || '', issns, quartile: /^Q[1-4]$/.test(q) ? q : '', scopus_status: '', oak_status: '', publisher: '', subjects: '', access: '' });
    }
  }
  if (rows < 100) throw new Error(`SCImago CSV juda qisqa (${rows} qator) — fayl to'liq emas`);
  return { items, rows };
}

/** OAK "Scopus'dan chiqarilgan" .xlsx: sarlavha qatori (title + issn ustunlari) avtomatik topiladi */
async function parseDiscontinuedXlsx(bytes) {
  const sheets = await parseXlsx(bytes);
  const items = [];
  for (const rows of sheets) {
    const hi = rows.findIndex((r) => r.some((c) => /title/i.test(c)) && r.some((c) => /issn/i.test(c)));
    if (hi < 0) continue;
    const head = rows[hi];
    const iT = head.findIndex((c) => /source\s*title|^title/i.test(c)) >= 0 ? head.findIndex((c) => /source\s*title|^title/i.test(c)) : head.findIndex((c) => /title/i.test(c));
    const iIssn = head.map((c, i) => (/issn/i.test(c) ? i : -1)).filter((i) => i >= 0);
    for (const r of rows.slice(hi + 1)) {
      const name = (r[iT] || '').trim();
      const issns = issnList(iIssn.map((i) => r[i] || '').join(','));
      if (name || issns.length) items.push({ name, issn: issns[0] || '', issns, quartile: '', scopus_status: 'discontinued', oak_status: '', publisher: '', subjects: '', access: '' });
    }
  }
  if (!items.length) throw new Error("Excel faylida sarlavha (Title / ISSN) topilmadi");
  return items;
}

/**
 * source: 'scopus' | 'oak'
 * mode:  'full'  — manbada yo'q, lekin bazada faol bo'lgan jurnallar "chiqib ketgan" deb belgilanadi (to'liq ro'yxat uchun)
 *        'delta' — faqat berilgan yozuvlar yangilanadi
 * keepDiscontinued: Scopus holati allaqachon 'discontinued' bo'lsa, uni qayta 'active' qilmaydi (faqat kvartil yangilanadi)
 * Barcha yozuvlar bitta (bo'laklangan) batch bilan bajariladi — D1 so'rovlar sonini tejaydi.
 */
async function applyFeed(db, items, source, { mode = 'delta', addNew = false, keepDiscontinued = false, nameOnlyMinWords = 0, fillIssn = true } = {}) {
  const all = await db.prepare('SELECT * FROM journals').all();
  const byIssn = new Map();
  for (const j of all) for (const i of issnList(j.issn)) byIssn.set(i, j);
  const byName = new Map(all.map((j) => [clean(j.name), j]));
  const seen = new Set();
  const stats = { updated: 0, added: 0, delisted: 0, unchanged: 0, review: [] };
  const stmts = [];
  const set = (j, field, val) => {
    if (String(j[field] ?? '') === String(val ?? '')) return false;
    stmts.push([`UPDATE journals SET ${field}=?, updated_at=datetime('now') WHERE id=?`, val, j.id]);
    stmts.push(changeStmt(j.id, field, j[field], val, `feed:${source}`));
    j[field] = val;
    return true;
  };
  const createdNames = new Set();
  for (const it of items) {
    if (!it.name && !(it.issns || []).length) continue;
    // Moslashtirish: ISSN — ishonchli. Nom bo'yicha faqat bazadagi jurnalning ISSN'i noma'lum bo'lsa;
    // ikkala tomonda ISSN bor va farq qilsa — bu BOSHQA jurnal (nomdoshlik). Umumiy (qisqa) nomlar avtomatik qo'llanmaydi.
    const itemIssns = it.issns && it.issns.length ? it.issns : (it.issn ? [it.issn] : []);
    let j = itemIssns.map((i) => byIssn.get(i)).find(Boolean);
    if (!j) {
      const cand = byName.get(clean(it.name));
      if (cand && !(itemIssns.length && issnList(cand.issn).length)) {
        if (nameOnlyMinWords && clean(cand.name).split(' ').length < nameOnlyMinWords) { stats.review.push(it.name); stats.unchanged++; continue; }
        j = cand;
      }
    }
    if (!j) {
      if (!addNew || !it.name || createdNames.has(it.name.toLowerCase())) { stats.unchanged++; continue; }
      createdNames.add(it.name.toLowerCase());
      stmts.push([`INSERT OR IGNORE INTO journals(name,issn,publisher,subjects,access,scopus_status,quartile,oak_status,country,verified) VALUES(?,?,?,?,?,?,?,?,?,1)`,
        it.name, it.issn, it.publisher, it.subjects, it.access === 'paid' ? 'paid' : 'free', source === 'scopus' ? 'active' : 'none', it.quartile, source === 'oak' ? 'active' : 'none', source === 'oak' ? "O'zbekiston" : '']);
      stmts.push(['INSERT INTO journal_changes(journal_id,field,old_value,new_value,source) SELECT id,\'created\',\'\',name,? FROM journals WHERE name=?', `feed:${source}`, it.name]);
      stats.added++;
      continue;
    }
    seen.add(j.id);
    let changed = false;
    if (source === 'scopus') {
      if (!(keepDiscontinued && j.scopus_status === 'discontinued')) changed = set(j, 'scopus_status', it.scopus_status || 'active') || changed;
      if (it.quartile) changed = set(j, 'quartile', it.quartile) || changed;
    } else if (source === 'oak') {
      changed = set(j, 'oak_status', it.oak_status || 'active') || changed;
    }
    if (fillIssn && it.issn && !j.issn) { set(j, 'issn', it.issn); for (const i of issnList(it.issn)) byIssn.set(i, j); }
    if (changed) { stmts.push(['UPDATE journals SET verified=1 WHERE id=?', j.id]); stats.updated++; } else stats.unchanged++;
  }
  if (mode === 'full') {
    const col = source === 'scopus' ? 'scopus_status' : 'oak_status';
    const gone = source === 'scopus' ? 'discontinued' : 'removed';
    for (const j of all) if (j[col] === 'active' && !seen.has(j.id)) { set(j, col, gone); stats.delisted++; }
  }
  await batchChunked(db, stmts, 80);
  return stats;
}

const describe = (s) => `yangilandi: ${s.updated}, yangi: ${s.added}, ro'yxatdan chiqqan: ${s.delisted}` + (s.review?.length ? `; nomi umumiy bo'lgani uchun avtomatik qo'llanmadi (ISSN kerak): ${s.review.slice(0, 8).join(', ')}${s.review.length > 8 ? '…' : ''}` : '');

// ---------------- Avtomatik yuklash ----------------
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function download(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json,text/html;q=0.8,*/*;q=0.5', 'accept-language': 'en-US,en;q=0.9', referer: new URL(url).origin + '/' }, redirect: 'follow', signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length < 50) throw new Error("javob bo'sh");
  return bytes;
}
const looksHtml = (text) => /^\s*<(!doctype|html|head|body)/i.test(text.slice(0, 200));

/** SCImago CSV matnini bazadagi jurnallarga qo'llaydi (katta fayl uchun tez skaner) */
async function applyScimagoText(db, text) {
  const journals = await db.prepare('SELECT name, issn FROM journals').all();
  const names = new Set(journals.map((j) => clean(j.name)));
  const issns = new Set(journals.flatMap((j) => issnList(j.issn)));
  const { items, rows } = scanScimago(text, names, issns);
  const stats = await applyFeed(db, items, 'scopus', { mode: 'delta', keepDiscontinued: true, nameOnlyMinWords: 2 });
  return { rows, found: items.length, stats, text: `${rows} qator ko'rib chiqildi, bazadagi ${items.length} ta jurnal topildi — ${describe(stats)}` };
}
const isScimagoCsv = (text) => /sjr best quartile/i.test(String(text).slice(0, 3000));

async function runSource(db, key) {
  const url = sourceUrl(key);
  const bytes = await download(url);
  if (key === 'discontinued') {
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new Error("javob .xlsx emas (sayt bloklagan yoki manzil o'zgargan bo'lishi mumkin)");
    const items = await parseDiscontinuedXlsx(bytes);
    // ISSN yoki to'liq (>=3 so'zli) nom bo'yicha; ISSN faqat ishonchli manbadan (SCImago) to'ldiriladi
    const stats = await applyFeed(db, items, 'scopus', { mode: 'delta', nameOnlyMinWords: 3, fillIssn: false });
    return `${items.length} ta chiqarilgan jurnal o'qildi — ${describe(stats)}`;
  }
  const text = new TextDecoder().decode(bytes);
  if (looksHtml(text)) throw new Error("javob CSV emas, HTML sahifa (sayt avtomatik yuklashni bloklagan bo'lishi mumkin)");
  if (key === 'scimago') {
    return (await applyScimagoText(db, text)).text;
  }
  const items = parseFeed(text);
  const stats = await applyFeed(db, items, SOURCES[key].source, { mode: process.env[`${SOURCES[key].env}_FULL`] === '1' ? 'full' : 'delta' });
  return `${items.length} ta yozuv o'qildi — ${describe(stats)}`;
}

/** Barcha sozlangan manbalarni (TTL bo'yicha) yuklaydi. Xabar matnini yoki null qaytaradi. */
async function syncConfiguredFeeds(db, { force = false, quiet = false } = {}) {
  const ttlMs = Math.max(1, Number(process.env.FEED_TTL_HOURS || 168)) * 3600e3;
  const out = [];
  for (const key of ['scimago', 'discontinued', 'oak']) {
    if (!sourceUrl(key)) continue;
    const label = SOURCES[key].label;
    const now = Date.now();
    if (!force) {
      const lastOk = Number(await getSetting(db, `feed_ok_${key}`, '0'));
      const lastTry = Number(await getSetting(db, `feed_try_${key}`, '0'));
      if (now - lastOk < ttlMs || now - lastTry < 6 * 3600e3) continue; // yaqinda yuklangan yoki yaqinda urinilgan
    }
    await setSetting(db, `feed_try_${key}`, now);
    try {
      const msg = await runSource(db, key);
      await setSetting(db, `feed_ok_${key}`, Date.now());
      await setSetting(db, `feed_status_${key}`, JSON.stringify({ at: new Date().toISOString(), ok: true, message: msg }));
      out.push(`${label}: ${msg}`);
    } catch (e) {
      const msg = `yuklab bo'lmadi (${e.message})`;
      await setSetting(db, `feed_status_${key}`, JSON.stringify({ at: new Date().toISOString(), ok: false, message: msg }));
      if (!quiet) out.push(`${label}: ${msg}`); // foydalanuvchiga texnik xatolar ko'rsatilmaydi (admin panelida ko'rinadi)
    }
  }
  return out.length ? out.join('; ') + '.' : null;
}

/** Admin paneli uchun: har bir manbaning manzili va oxirgi natijasi */
async function feedStatus(db) {
  const list = [];
  for (const key of Object.keys(SOURCES)) {
    const url = sourceUrl(key);
    const raw = await getSetting(db, `feed_status_${key}`, '');
    let st = null; try { st = raw ? JSON.parse(raw) : null; } catch { /* e'tiborsiz */ }
    list.push({ key, label: SOURCES[key].label, enabled: !!url, custom: !!process.env[SOURCES[key].env], last: st });
  }
  return list;
}

module.exports = { applyScimagoText, isScimagoCsv, parseFeed, parseCsv, applyFeed, syncConfiguredFeeds, feedStatus, describe, normalizeItem, scanScimago, parseDiscontinuedXlsx, sourceUrl, SOURCES };

'use strict';
/*
 * Tashqi manbalardan (SCImago/Scopus CSV, OAK ro'yxati JSON/CSV) master `journals` jadvalini yangilash.
 * Manbalar:  SCOPUS_FEED_URL  — SCImago "journal rank" CSV yoki JSON massiv
 *            OAK_FEED_URL     — JSON massiv yoki CSV (name;issn;...)
 * yoki admin kabinetidan fayl/matn yuklash. Har bir o'zgarish journal_changes jadvaliga yoziladi.
 */
const { changeStmt } = require('./recommend');
const { getSetting, setSetting, batchChunked } = require('./db');

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

const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9а-яё]+/g, ' ').trim();
const normIssn = (s) => String(s || '').replace(/[^0-9xX]/g, '').toUpperCase();

/** Turli format yozuvlarini yagona ko'rinishga keltiradi */
function normalizeItem(r) {
  const get = (...keys) => { for (const k of keys) if (r[k] != null && r[k] !== '') return r[k]; return ''; };
  const q = String(get('quartile', 'sjr best quartile', 'best quartile', 'q')).toUpperCase();
  const issn = String(get('issn', 'issn_print', 'eissn')).split(/[,;]/)[0];
  return {
    name: String(get('name', 'title', 'sourcetitle', 'source title')).trim(),
    issn: normIssn(issn),
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

/**
 * source: 'scopus' | 'oak'
 * mode:  'full'  — manbada yo'q, lekin bazada faol bo'lgan jurnallar "chiqib ketgan" deb belgilanadi (to'liq ro'yxat uchun)
 *        'delta' — faqat berilgan yozuvlar yangilanadi
 * Barcha yozuvlar bitta (bo'laklangan) batch bilan bajariladi — D1 so'rovlar sonini tejaydi.
 */
async function applyFeed(db, items, source, { mode = 'delta', addNew = false } = {}) {
  const all = await db.prepare('SELECT * FROM journals').all();
  const byIssn = new Map(all.filter((j) => j.issn).map((j) => [normIssn(j.issn), j]));
  const byName = new Map(all.map((j) => [clean(j.name), j]));
  const seen = new Set();
  const stats = { updated: 0, added: 0, delisted: 0, unchanged: 0 };
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
    if (!it.name) continue;
    let j = (it.issn && byIssn.get(it.issn)) || byName.get(clean(it.name));
    if (!j) {
      if (!addNew || createdNames.has(it.name.toLowerCase())) { stats.unchanged++; continue; }
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
      changed = set(j, 'scopus_status', it.scopus_status || 'active') || changed;
      if (it.quartile) changed = set(j, 'quartile', it.quartile) || changed;
    } else if (source === 'oak') {
      changed = set(j, 'oak_status', it.oak_status || 'active') || changed;
    }
    if (it.issn && !j.issn) set(j, 'issn', it.issn);
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

const describe = (s) => `yangilandi: ${s.updated}, yangi: ${s.added}, ro'yxatdan chiqqan: ${s.delisted}`;

/** Muhit o'zgaruvchilarida URL berilgan bo'lsa, ularni (6 soatda bir martadan ko'p emas) yuklab sinxronlaydi */
async function syncConfiguredFeeds(db, { force = false } = {}) {
  const out = [];
  for (const [source, envName] of [['scopus', 'SCOPUS_FEED_URL'], ['oak', 'OAK_FEED_URL']]) {
    const url = process.env[envName];
    if (!url) continue;
    const last = Number(await getSetting(db, `feed_last_${source}`, '0'));
    if (!force && Date.now() - last < 6 * 3600e3) continue;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = parseFeed(await res.text());
      const stats = await applyFeed(db, items, source, { mode: process.env[`${envName}_FULL`] === '1' ? 'full' : 'delta' });
      await setSetting(db, `feed_last_${source}`, Date.now());
      out.push(`${source.toUpperCase()} fidi: ${describe(stats)}`);
    } catch (e) { out.push(`${source.toUpperCase()} fidini yuklab bo'lmadi (${e.message})`); }
  }
  return out.length ? out.join('; ') + '.' : null;
}

module.exports = { parseFeed, parseCsv, applyFeed, syncConfiguredFeeds, describe, normalizeItem };

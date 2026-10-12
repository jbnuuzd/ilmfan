'use strict';
const ai = require('./ai');

const CATEGORIES = ['scopus', 'oak', 'impact', 'impact_lite', 'conference'];
const CHEAP_USD = 600; // «arzon» chegarasi: nashr to'lovi shundan oshmasin
const QRANK = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
const QWEIGHT = { Q1: 4, Q2: 3, Q3: 2, Q4: 1 };

// Mavzu so'zlarini jurnal teglariga bog'lovchi kichik lug'at
const KW = {
  kasb: 'vocational', hunar: 'vocational', kollej: 'vocational', texnikum: 'vocational', dual: 'vocational',
  raqamli: 'edtech', masofaviy: 'edtech', elektron: 'edtech', texnologiya: 'edtech', sun: 'edtech', intellekt: 'edtech', virtual: 'edtech', mobil: 'edtech',
  oliy: 'highered', universitet: 'highered', talaba: 'highered',
  pedagog: 'pedagogy', metodika: 'pedagogy', o_qituvchi: 'pedagogy', kompetensiya: 'pedagogy', ta_lim: 'education', tarbiya: 'pedagogy',
  iqtisod: 'economics', moliya: 'finance', bank: 'finance', menejment: 'management', boshqaruv: 'management',
  energiya: 'energy', quyosh: 'energy', material: 'materials', dastur: 'cs', algoritm: 'cs', tibbiyot: 'medicine', kimyo: 'chemistry', qishloq: 'agri',
  huquq: 'law', til: 'linguistics', adabiyot: 'humanities',
  vocational: 'vocational', education: 'education', digital: 'edtech', technology: 'edtech', learning: 'education',
  // ruscha o'zaklar (mavzu rus tilida kiritilsa ham jurnal tavsiyasi ishlashi uchun)
  профес: 'vocational', колледж: 'vocational', техникум: 'vocational', дуальн: 'vocational',
  цифров: 'edtech', дистанц: 'edtech', электронн: 'edtech', технолог: 'edtech', искусственн: 'edtech', виртуальн: 'edtech', мобильн: 'edtech',
  высш: 'highered', университет: 'highered', студент: 'highered',
  педагог: 'pedagogy', методик: 'pedagogy', учител: 'pedagogy', компетенц: 'pedagogy', воспитан: 'pedagogy', образован: 'education', обучен: 'education',
  экономик: 'economics', финанс: 'finance', банк: 'finance', менеджмент: 'management', управлен: 'management',
  туризм: 'tourism', turizm: 'tourism', tourism: 'tourism', гостинич: 'tourism', mehmonxona: 'tourism', sayyoh: 'tourism',
  энерг: 'energy', солнечн: 'energy', материал: 'materials', программ: 'cs', алгоритм: 'cs', медицин: 'medicine', хими: 'chemistry', сельск: 'agri',
  юридич: 'law', право: 'law', язык: 'linguistics', литератур: 'humanities',
};

const tagsOf = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

function topicTags(topic) {
  const hits = [];
  const words = String(topic || '').toLowerCase().replace(/[’'ʻ`‘]/g, '_').split(/[^\p{L}\p{N}_]+/u);
  for (const w of words) for (const [k, tag] of Object.entries(KW)) if (w.startsWith(k)) hits.push([k, tag]);
  return hits;
}

const isCheap = (j) => j.access === 'free' || (j.apc_usd != null && j.apc_usd <= CHEAP_USD);

function scoreJournal(j, direction, topic, category) {
  const dTags = new Set(tagsOf(direction?.tags));
  const jTags = tagsOf(j.subjects);
  const tagHits = jTags.filter((t) => dTags.has(t));
  const kw = topicTags(topic);
  const kwHits = [...new Set(kw.filter(([, tag]) => jTags.includes(tag)).map(([k]) => k))];
  // Birinchi teg — jurnalning asosiy yo'nalishi: ustuvorlik
  const primary = jTags.length && dTags.has(jTags[0]) ? 1 : 0;
  const rel = Math.min(1, (tagHits.length + primary + kwHits.length * 0.7) / 3);
  const prestige = j.scopus_status === 'active' ? (QWEIGHT[j.quartile] || 1) / 4 : (j.impact_factor ? Math.min(1, j.impact_factor / 8) : 0.4);
  const accept = (j.acceptance || 3) / 5;
  // arzon ro'yxatda narx ham hisobga olinadi: bepul > arzon pullik
  const cheap = category === 'impact_lite' ? (j.access === 'free' ? 1 : 1 - Math.min(1, (j.apc_usd || CHEAP_USD) / CHEAP_USD)) : 0;
  const base = category === 'impact_lite' ? 0.4 * rel + 0.2 * prestige + 0.2 * accept + 0.2 * cheap : 0.5 * rel + 0.25 * prestige + 0.25 * accept;
  return { score: rel === 0 ? 0 : base, matchScore: Math.round(100 * base), tagHits, kwHits };
}

function matchesCategory(j, category) {
  if (category === 'conference') return j.kind === 'conference';
  if (j.kind !== 'journal') return false;
  switch (category) {
    case 'scopus': return j.scopus_status === 'active';
    case 'oak': return j.oak_status === 'active';
    // Arzon va Scopus'da INDEKSLANMAGAN: Web of Science (ESCI/JCR) yoki muqobil IF manbasi bor; bepul yoki nashr to'lovi ≤ CHEAP_USD
    case 'impact_lite': return j.scopus_status === 'none' && (j.wos === 1 || !!j.if_source) && isCheap(j);
    case 'impact': return (j.impact_factor != null || j.wos === 1) && (j.scopus_status === 'active' || j.oak_status === 'active' || j.wos === 1);
    default: throw new Error('Noto‘g‘ri kategoriya');
  }
}

function candidatesFrom(journals, category, access, direction, topic, excludeIds = []) {
  return journals.filter((j) => j.access === access && matchesCategory(j, category) && !excludeIds.includes(j.id))
    .map((j) => ({ ...j, ...scoreJournal(j, direction, topic, category) }))
    .filter((j) => j.score > 0)
    .sort((a, b) => b.score - a.score || (a.quartile || 'Q9').localeCompare(b.quartile || 'Q9'));
}

async function candidates(db, category, access, direction, topic, excludeIds = []) {
  const rows = await db.prepare('SELECT * FROM journals WHERE access=?').all(access);
  return candidatesFrom(rows, category, access, direction, topic, excludeIds);
}

const COUNT = 10;

async function getProfileCtx(db, userId) {
  const profile = await db.prepare('SELECT * FROM profiles WHERE user_id=?').get(userId);
  const direction = profile ? await db.prepare('SELECT * FROM directions WHERE code=?').get(profile.direction_code) : null;
  return { profile, direction };
}

async function ensureRecommendations(db, userId, category, access, lang = 'uz') {
  const { profile, direction } = await getProfileCtx(db, userId);
  if (!profile || !direction) return { needProfile: true };
  const existing = (await db.prepare('SELECT journal_id FROM user_journals WHERE user_id=? AND category=?').all(userId, category)).map((r) => r.journal_id);
  const activeCount = (await db.prepare("SELECT COUNT(*) c FROM user_journals WHERE user_id=? AND category=? AND access=? AND flag=''").get(userId, category, access)).c;
  const need = COUNT - activeCount;
  if (need > 0) {
    const picks = (await candidates(db, category, access, direction, profile.topic, existing)).slice(0, need);
    await addRows(db, userId, category, access, picks, direction, profile, null, '', lang);
  }
  return {};
}

async function addRows(db, userId, category, access, picks, direction, profile, replacesList, note = '', lang = 'uz') {
  if (!picks.length) return;
  const fits = await ai.journalFits(profile, direction, picks, lang);
  await db.batch(picks.map((j, i) => {
    const f = fits.get(j.id);
    return ['INSERT OR IGNORE INTO user_journals(user_id,journal_id,category,access,snap_quartile,fit_score,fit_text,replaces,note) VALUES(?,?,?,?,?,?,?,?,?)',
      userId, j.id, category, access, j.quartile || '', f.score, f.text, replacesList ? replacesList[i] ?? null : null, replacesList ? 'new' : note];
  }));
}

async function list(db, userId, category, access) {
  return db.prepare(`
    SELECT uj.id AS uj_id, uj.flag, uj.flag_reason, uj.note, uj.replaces, uj.snap_quartile, uj.fit_score, uj.fit_text, uj.added_at,
           j.*
    FROM user_journals uj JOIN journals j ON j.id = uj.journal_id
    WHERE uj.user_id=? AND uj.category=? AND uj.access=?
    ORDER BY (uj.flag != '') ASC, uj.fit_score DESC, uj.id ASC`).all(userId, category, access);
}

/**
 * REFRESH: mavjud tavsiyalarni master ma'lumotlar bilan solishtiradi.
 *  - kvartil pasaygan / Scopus'dan chiqqan / OAK ro'yxatidan chiqqan jurnal O'CHIRILMAYDI, qizil belgilanadi;
 *  - har bir belgilangan jurnal o'rniga yangi tavsiya qo'shiladi (jami faol tavsiyalar 10 ta bo'lib qoladi);
 *  - kvartil ko'tarilgan bo'lsa — yashil belgi.
 */
async function refresh(db, userId, category, access, { syncFeeds, lang = 'uz' } = {}) {
  const { profile, direction } = await getProfileCtx(db, userId);
  if (!profile || !direction) return { needProfile: true };
  const feedMsg = syncFeeds ? await syncFeeds() : null;

  await ensureRecommendations(db, userId, category, access, lang);
  // oldingi refreshdagi "yangi"/"ko'tarilgan" belgilari yangi tekshiruvda tozalanadi
  await db.prepare("UPDATE user_journals SET note='' WHERE user_id=? AND category=? AND access=? AND flag=''").run(userId, category, access);
  const rows = await db.prepare(`
    SELECT uj.*, j.name, j.quartile, j.scopus_status, j.oak_status, j.kind, j.wos, j.if_source, j.access AS j_access, j.apc_usd FROM user_journals uj
    JOIN journals j ON j.id=uj.journal_id WHERE uj.user_id=? AND uj.category=? AND uj.access=? AND uj.flag=''`).all(userId, category, access);

  const flagged = [], upgraded = [], stmts = [];
  const UPD = 'UPDATE user_journals SET flag=?, flag_reason=?, note=?, snap_quartile=? WHERE id=?';
  for (const r of rows) {
    let flag = '', reason = '';
    if ((category === 'scopus' || category === 'impact') && r.scopus_status !== 'active' && r.scopus_status !== 'none') {
      flag = 'delisted'; reason = "Jurnal Scopus bazasidan chiqib ketgan (yoki faolligi to'xtatilgan)";
    }
    if (category === 'impact_lite') {
      if (r.wos !== 1 && !r.if_source) { flag = 'delisted'; reason = "Jurnal Web of Science'dagi (ESCI/JCR) maqomini yo'qotgan"; }
      else if (r.j_access !== 'free' && !(r.apc_usd != null && r.apc_usd <= CHEAP_USD)) { flag = 'downgraded'; reason = "Nashr to'lovi «arzon» chegarasidan (" + CHEAP_USD + " USD) oshgan"; }
    }
    if (!flag && category === 'oak' && r.oak_status !== 'active') {
      flag = 'removed'; reason = "Jurnal OAK tomonidan e'tirof etilgan ro'yxatdan chiqarilgan";
    }
    if (!flag && r.snap_quartile && r.quartile && QRANK[r.quartile] > QRANK[r.snap_quartile]) {
      flag = 'downgraded'; reason = `Kvartil pasaygan: ${r.snap_quartile} → ${r.quartile}`;
    }
    if (flag) { stmts.push([UPD, flag, reason, '', r.snap_quartile, r.id]); flagged.push({ ...r, reason }); }
    else if (r.snap_quartile && r.quartile && QRANK[r.quartile] < QRANK[r.snap_quartile]) {
      stmts.push([UPD, '', '', 'upgraded', r.quartile, r.id]); upgraded.push({ ...r });
    } else stmts.push([UPD, '', '', '', r.quartile || r.snap_quartile, r.id]);
  }
  await db.batch(stmts);

  let added = 0;
  if (flagged.length) {
    const exclude = (await db.prepare('SELECT journal_id FROM user_journals WHERE user_id=? AND category=?').all(userId, category)).map((r) => r.journal_id);
    const picks = (await candidates(db, category, access, direction, profile.topic, exclude)).slice(0, flagged.length);
    await addRows(db, userId, category, access, picks, direction, profile, flagged.map((f) => f.id), '', lang);
    added = picks.length;
  }
  // Agar avvalgi refreshlarda yetishmagan o'rinlar bo'lsa — to'ldirish
  await ensureRecommendations(db, userId, category, access, lang);

  const lines = [
    ...flagged.map((f) => `«${f.name}»: ${f.reason}`),
    ...upgraded.map((u) => `«${u.name}»: kvartil ko'tarildi (${u.snap_quartile} → ${u.quartile})`),
  ];
  let summary = lines.length
    ? `${flagged.length} ta jurnalda salbiy o'zgarish, ${upgraded.length} ta jurnalda ijobiy o'zgarish aniqlandi; ${added} ta yangi jurnal tavsiya etildi.`
    : "Hech qanday o'zgarish aniqlanmadi — barcha tavsiyalar dolzarb.";
  if (feedMsg) summary += ` ${feedMsg}`;
  const aiNote = lines.length ? await ai.summarizeChanges(lines, lang) : null;
  await db.prepare('INSERT INTO refresh_log(user_id,category,access,summary) VALUES(?,?,?,?)').run(userId, category, access, summary + (aiNote ? `\n${aiNote}` : ''));
  return { summary, aiNote, flagged: flagged.length, upgraded: upgraded.length, added, lines };
}

/** Jurnal o'zgarishi tarixi: statement (batch uchun) va to'g'ridan-to'g'ri yozish */
const changeStmt = (journalId, field, oldV, newV, source) =>
  ['INSERT INTO journal_changes(journal_id,field,old_value,new_value,source) VALUES(?,?,?,?,?)', journalId, field, oldV == null ? '' : String(oldV), newV == null ? '' : String(newV), source];
const logChange = (db, ...args) => db.batch([changeStmt(...args)]);

module.exports = { CHEAP_USD, CATEGORIES, scoreJournal, candidates, candidatesFrom, matchesCategory, ensureRecommendations, list, refresh, logChange, changeStmt, getProfileCtx, COUNT };

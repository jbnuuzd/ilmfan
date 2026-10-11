'use strict';
/*
 * Ilova yadrosi — Web-standart Request/Response. Node (server.js) va Cloudflare Workers (worker.mjs)
 * ikkalasida ham ishlaydi; node: modullaridan foydalanmaydi.
 */
const auth = require('./auth');
const ai = require('./ai');
const rec = require('./recommend');
const feeds = require('./feeds');
const planner = require('./planner');
const { buildGuide } = require('./guide');
const { knowledge } = require('./knowledge');

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = (m) => new HttpError(400, m);

// ---- Admin CRUD konfiguratsiyasi ----
const ENTITIES = {
  journals: { table: 'journals', order: 'name', cols: ['name', 'kind', 'issn', 'publisher', 'country', 'since_year', 'access', 'apc_usd', 'scopus_status', 'quartile', 'oak_status', 'impact_factor', 'if_source', 'wos', 'subjects', 'acceptance', 'review_weeks', 'official_url', 'scopus_url', 'oak_url', 'description', 'verified'], track: ['scopus_status', 'quartile', 'oak_status', 'impact_factor', 'access'] },
  directions: { table: 'directions', pk: 'code', order: 'code', cols: ['code', 'name', 'field_group', 'tags', 'hints'] },
  requirements: { table: 'requirements', order: 'degree, id', cols: ['degree', 'kind', 'title', 'min_count', 'description', 'source_url', 'verified'] },
  doc_templates: { table: 'doc_templates', order: 'id', cols: ['key', 'category', 'title', 'description', 'phase', 'required', 'directions', 'cancelled_from'] },
  quotes: { table: 'quotes', order: 'id', cols: ['author', 'text', 'note'] },
};
const INTS = new Set(['since_year', 'apc_usd', 'wos', 'acceptance', 'review_weeks', 'verified', 'min_count', 'required']);
const REALS = new Set(['impact_factor']);
function coerce(col, v) {
  if (v === '' || v == null) return INTS.has(col) || REALS.has(col) ? (['wos', 'verified', 'required', 'acceptance', 'min_count'].includes(col) ? (col === 'acceptance' ? 3 : 0) : null) : '';
  if (INTS.has(col)) { const n = parseInt(v, 10); if (Number.isNaN(n)) throw bad(`${col} butun son bo'lishi kerak`); return n; }
  if (REALS.has(col)) { const n = parseFloat(v); if (Number.isNaN(n)) throw bad(`${col} son bo'lishi kerak`); return n; }
  return String(v);
}
const PUB_KINDS = ['oak', 'foreign', 'conf_int', 'conf_nat', 'other'];
const PUB_STATUS = ['draft', 'submitted', 'review', 'revision', 'accepted', 'published', 'rejected'];
const IN_PROGRESS = ['submitted', 'review', 'revision', 'accepted'];
const validDate = (s) => s === '' || (/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)));
const dayNumber = () => Math.floor(Date.now() / 864e5);

function createHandler(db) {
  const routes = [];
  const route = (method, pattern, access, handler) => routes.push({ method, re: new RegExp(`^${pattern}$`), access, handler });

  // ---------- yordamchilar ----------
  function buildContext(profile, direction, requirements, docTemplates, doneKeys) {
    const plan = planner.buildPlan({ months: profile.months, startMonth: profile.start_month, requirements, docTemplates, direction });
    return { profile, direction, requirements, docTemplates, plan, doneKeys, progress: planner.progress(plan, doneKeys) };
  }

  async function userContext(userId) {
    const profile = await db.prepare('SELECT * FROM profiles WHERE user_id=?').get(userId);
    if (!profile || !profile.direction_code) return { profile: null };
    const [direction, requirements, docTemplates, done] = await Promise.all([
      db.prepare('SELECT * FROM directions WHERE code=?').get(profile.direction_code),
      db.prepare('SELECT * FROM requirements WHERE degree=? ORDER BY id').all(profile.degree),
      db.prepare('SELECT * FROM doc_templates ORDER BY id').all(),
      db.prepare('SELECT task_key FROM user_tasks WHERE user_id=? AND done=1').all(userId),
    ]);
    return buildContext(profile, direction, requirements, docTemplates, new Set(done.map((r) => r.task_key)));
  }

  function requirementStatus(ctx) {
    return ctx.requirements.map((r) => {
      const tasks = ctx.plan.months.flatMap((m) => m.tasks).filter((t) => t.reqId === r.id);
      return { ...r, planned: tasks.length, done: tasks.filter((t) => ctx.doneKeys.has(t.key)).length };
    });
  }

  // ---------- Ommaviy ----------
  route('GET', '/api/meta', 'public', async () => ({
    directions: await db.prepare('SELECT code,name,field_group FROM directions ORDER BY field_group, code').all(),
    ai: ai.enabled(),
    notice: 'Platformadagi jurnal kvartillari va to‘lov shartlari «tekshirilmagan» deb belgilangan namuna ma’lumotlar bo‘lishi mumkin. Rasmiy manbalar (scopus.com, scimagojr.com, oak.uz) bilan solishtiring.',
  }));

  route('GET', '/api/knowledge', 'public', () => knowledge);

  route('POST', '/api/register', 'public', async (req, body, ctx) => {
    const login = String(body.login || '').trim().toLowerCase();
    const full = String(body.full_name || '').trim();
    const pw = String(body.password || '');
    if (!/^[a-z0-9_.-]{3,32}$/.test(login)) throw bad("Login 3–32 belgi: lotin harflari, raqam, _ . - ");
    if (full.length < 3) throw bad("Ism-familiyani to'liq kiriting");
    if (pw.length < 8) throw bad("Parol kamida 8 belgidan iborat bo'lsin");
    if (await db.prepare('SELECT 1 x FROM users WHERE login=?').get(login)) throw bad('Bu login band');
    const r = await db.prepare("INSERT INTO users(login,pass_hash,role,full_name) VALUES(?,?, 'user',?)").run(login, await auth.hashPassword(pw), full);
    ctx.setCookie(await auth.createSession(db, r.lastInsertRowid));
    return { ok: true, role: 'user' };
  });

  route('POST', '/api/login', 'public', async (req, body, ctx) => {
    const login = String(body.login || '').trim().toLowerCase();
    const key = `${ctx.ip}|${login}`;
    if (await auth.rateLimited(db, key)) throw new HttpError(429, "Juda ko'p urinish. Bir necha daqiqadan so'ng qayta urinib ko'ring.");
    const u = await db.prepare('SELECT * FROM users WHERE login=?').get(login);
    let ok = false;
    if (u) ok = await auth.verifyPassword(String(body.password || ''), u.pass_hash); else await auth.dummyVerify(String(body.password || ''));
    if (!ok) throw new HttpError(401, "Login yoki parol noto'g'ri");
    await auth.clearAttempts(db, key);
    ctx.setCookie(await auth.createSession(db, u.id));
    return { ok: true, role: u.role };
  });

  route('POST', '/api/logout', 'public', async (req, body, ctx) => {
    if (ctx.token) await db.prepare('DELETE FROM sessions WHERE token=?').run(ctx.token);
    ctx.clearCookie();
    return { ok: true };
  });

  route('GET', '/api/me', 'public', (req, body, ctx) => ({ user: ctx.user }));

  // ---------- Foydalanuvchi ----------
  route('GET', '/api/profile', 'user', async (req, body, ctx) => ({ profile: (await db.prepare('SELECT * FROM profiles WHERE user_id=?').get(ctx.user.id)) || null }));

  route('PUT', '/api/profile', 'user', async (req, body, ctx) => {
    const status = ['doctoral', 'independent', 'beginner'].includes(body.status) ? body.status : null;
    const degree = ['phd', 'dsc'].includes(body.degree) ? body.degree : 'phd';
    if (!status) throw bad('Maqomingizni tanlang');
    if (!(await db.prepare('SELECT 1 x FROM directions WHERE code=?').get(body.direction_code))) throw bad("Tadqiqot yo'nalishini tanlang");
    const topic = String(body.topic || '').trim().slice(0, 500);
    if (topic.length < 5) throw bad('Ilmiy ish mavzusini kiriting');
    const months = parseInt(body.months, 10);
    if (!(months >= 1 && months <= 60)) throw bad("Muddat 1 dan 60 oygacha bo'lishi kerak");
    const start = /^\d{4}-\d{2}$/.test(body.start_month || '') ? body.start_month : planner.currentMonth();
    const prev = await db.prepare('SELECT direction_code FROM profiles WHERE user_id=?').get(ctx.user.id);
    await db.prepare(`INSERT INTO profiles(user_id,status,degree,direction_code,topic,months,start_month,updated_at) VALUES(?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET status=excluded.status, degree=excluded.degree, direction_code=excluded.direction_code, topic=excluded.topic, months=excluded.months, start_month=excluded.start_month, updated_at=datetime('now')`)
      .run(ctx.user.id, status, degree, body.direction_code, topic, months, start);
    if (prev && prev.direction_code !== body.direction_code) {
      // yo'nalish o'zgarsa, faqat belgilanmagan tavsiyalar qayta hisoblanadi — o'zgargan (qizil) eskilari saqlanadi
      await db.prepare("DELETE FROM user_journals WHERE user_id=? AND flag='' AND note=''").run(ctx.user.id);
    }
    return { ok: true };
  });

  route('GET', '/api/dashboard', 'user', async (req, body, ctx) => {
    const uc = await userContext(ctx.user.id);
    const quotes = await db.prepare('SELECT * FROM quotes ORDER BY id').all();
    const quote = quotes.length ? quotes[(dayNumber() + ctx.user.id) % quotes.length] : null;
    if (!uc.profile) return { quote, needProfile: true, name: ctx.user.full_name };
    const idx = planner.currentIndex(uc.plan);
    const curMonth = uc.plan.months[Math.min(Math.max(idx, 0), uc.plan.months.length - 1)];
    const pending = uc.plan.months.flatMap((m) => m.tasks.map((t) => ({ ...t, month: m.label, monthIndex: m.index }))).filter((t) => !uc.doneKeys.has(t.key));
    const overdue = pending.filter((t) => t.monthIndex - 1 < idx);
    const next = overdue[0] || pending[0] || null;
    const daysLeft = Math.ceil((new Date(`${uc.plan.endIso}T00:00:00Z`).getTime() - Date.now()) / 864e5);
    const day = new Date().toISOString().slice(0, 10);
    const mkey = `${day}:${uc.progress.pct}`;
    let m = await db.prepare('SELECT text FROM motivations WHERE user_id=? AND day=?').get(ctx.user.id, mkey);
    if (!m) {
      const text = await ai.motivation({ name: ctx.user.full_name, progressPct: uc.progress.pct, daysLeft, topic: uc.profile.topic, doneTasks: uc.progress.tasksDone, totalTasks: uc.progress.tasksTotal, nextTask: next?.title });
      await db.batch([
        ['INSERT OR REPLACE INTO motivations(user_id,day,text) VALUES(?,?,?)', ctx.user.id, mkey, text],
        ['DELETE FROM motivations WHERE user_id=? AND day != ? AND day NOT LIKE ?', ctx.user.id, mkey, `${day}:%`],
      ]);
      m = { text };
    }
    const alerts = [];
    const ps = await pubSummary(ctx.user.id, uc.requirements);
    for (const p of ps.slow.slice(0, 3)) alerts.push({ level: 'amber', text: `«${p.title}» ${p.weeks} hafta oldin yuborilgan (jurnalning odatdagi muddati ≈ ${Math.round(p.limit / 1.5)} hafta). Tahririyatga muloyim eslatma xati yuborishni o'ylab ko'ring.` });
    const flagged = (await db.prepare("SELECT COUNT(*) c FROM user_journals WHERE user_id=? AND flag!=''").get(ctx.user.id)).c;
    if (flagged) alerts.push({ level: 'red', text: `Tavsiya etilgan ${flagged} ta jurnalda o'zgarish aniqlangan (kvartil pasaygan yoki ro'yxatdan chiqqan). «Jurnallar» bo'limida ko'ring.` });
    if (overdue.length) alerts.push({ level: 'amber', text: `${overdue.length} ta vazifa rejadagi muddatdan kechikmoqda. Birinchisi: «${overdue[0].title}» (${overdue[0].month}).` });
    const docsLeft = pending.filter((t) => t.kind === 'doc' && !t.optional).length;
    if (docsLeft) alerts.push({ level: 'blue', text: `Himoya uchun ${docsLeft} ta majburiy hujjat/ishlanma hali tayyor emas. Hech narsa esdan chiqmasligi uchun «Hujjatlar» bo'limini kuzatib boring.` });
    return {
      name: ctx.user.full_name, quote, motivation: m.text, aiEnabled: ai.enabled(),
      progress: uc.progress, daysLeft, currentMonth: curMonth?.label, thisMonth: curMonth?.tasks.map((t) => ({ ...t, done: uc.doneKeys.has(t.key) })) || [],
      next, alerts, requirements: requirementStatus(uc), profile: uc.profile, direction: uc.direction,
      pubs: { byKind: ps.byKind, totalNeeded: ps.totalNeeded, publishedAll: ps.publishedAll, total: ps.pubs.length },
    };
  });

  route('GET', '/api/plan', 'user', async (req, body, ctx) => {
    const uc = await userContext(ctx.user.id);
    if (!uc.profile) return { needProfile: true };
    const idx = planner.currentIndex(uc.plan);
    const months = uc.plan.months.map((m) => ({ ...m, current: m.index - 1 === idx, tasks: m.tasks.map((t) => ({ ...t, done: uc.doneKeys.has(t.key) })) }));
    const reqs = requirementStatus(uc);
    const summary = reqs.map((r) => `${r.title}: ${r.min_count} ta`).join('; ');
    const advice = ai.enabled() ? await ai.ask('Siz ilmiy maslahatchisiz. Faqat o‘zbek tilida qisqa yozing.', `Yo'nalish: ${uc.direction?.name}. Mavzu: ${uc.profile.topic}. Muddat: ${uc.profile.months} oy. Talablar: ${summary}. 3 ta qisqa amaliy maslahat bering.`, { maxTokens: 350 }) : null;
    return { months, warnings: uc.plan.warnings, progress: uc.progress, requirements: reqs, profile: uc.profile, advice, startMonth: uc.plan.startMonth };
  });

  route('POST', '/api/plan/task', 'user', async (req, body, ctx) => {
    const uc = await userContext(ctx.user.id);
    if (!uc.profile) throw bad('Avval profilni to‘ldiring');
    const key = String(body.key || '');
    if (!uc.plan.months.some((m) => m.tasks.some((t) => t.key === key))) throw bad('Noma’lum vazifa');
    const done = body.done ? 1 : 0;
    await db.prepare(`INSERT INTO user_tasks(user_id,task_key,done,done_at) VALUES(?,?,?,CASE WHEN ?=1 THEN datetime('now') END)
      ON CONFLICT(user_id,task_key) DO UPDATE SET done=excluded.done, done_at=excluded.done_at`).run(ctx.user.id, key, done, done);
    if (done) uc.doneKeys.add(key); else uc.doneKeys.delete(key);
    return { ok: true, progress: planner.progress(uc.plan, uc.doneKeys) };
  });

  route('GET', '/api/documents', 'user', async (req, body, ctx) => {
    const uc = await userContext(ctx.user.id);
    if (!uc.profile) return { needProfile: true };
    const dirTags = new Set(String(uc.direction?.tags || '').split(',').filter(Boolean));
    const monthOf = new Map();
    uc.plan.months.forEach((m) => m.tasks.forEach((t) => { if (t.docKey) monthOf.set(t.docKey, m.label); }));
    const docs = uc.docTemplates
      .filter((d) => !d.directions || d.directions.split(',').some((t) => dirTags.has(t.trim())))
      .map((d) => ({ ...d, cancelled: !!d.cancelled_from && uc.plan.endIso >= d.cancelled_from, taskKey: `doc-${d.key}`, done: uc.doneKeys.has(`doc-${d.key}`), plannedMonth: monthOf.get(d.key) || null }));
    const hints = String(uc.direction?.hints || '').split('|').filter(Boolean);
    return { docs, hints, requirements: requirementStatus(uc), direction: uc.direction, newRegime: uc.plan.newRegime };
  });

  // ---------- Nashrlarim ----------
  async function pubSummary(userId, requirements) {
    const pubs = await db.prepare(`SELECT p.*, j.review_weeks FROM publications p LEFT JOIN journals j ON j.id=p.journal_id WHERE p.user_id=? ORDER BY p.id DESC`).all(userId);
    const kinds = requirements.filter((r) => PUB_KINDS.includes(r.kind) && r.kind !== 'other' && r.min_count > 0);
    const byKind = kinds.map((r) => ({ kind: r.kind, title: r.title, min: r.min_count,
      published: pubs.filter((p) => p.kind === r.kind && p.status === 'published').length,
      inProgress: pubs.filter((p) => p.kind === r.kind && IN_PROGRESS.includes(p.status)).length }));
    const totalNeeded = byKind.reduce((s, k) => s + k.min, 0);
    const publishedAll = pubs.filter((p) => p.status === 'published').length;
    const now = Date.now();
    const slow = pubs.filter((p) => ['submitted', 'review', 'revision'].includes(p.status) && p.submitted_at).map((p) => {
      const weeks = Math.floor((now - Date.parse(p.submitted_at)) / (7 * 864e5));
      return { ...p, weeks, limit: Math.round((p.review_weeks || 12) * 1.5) };
    }).filter((p) => p.weeks > p.limit);
    return { pubs, byKind, totalNeeded, publishedAll, slow };
  }

  // Chop etilganda mos reja vazifasi avtomatik belgilanadi; holat o'zgarsa yoki o'chirilsa — qaytariladi
  async function syncPubTask(userId, pub) {
    if (pub.status !== 'published' && pub.task_key) {
      await db.batch([['UPDATE user_tasks SET done=0, done_at=NULL WHERE user_id=? AND task_key=?', userId, pub.task_key], ['UPDATE publications SET task_key=? WHERE id=?', '', pub.id]]);
      return;
    }
    if (pub.status === 'published' && !pub.task_key && pub.kind !== 'other') {
      const uc = await userContext(userId);
      if (!uc.profile) return;
      const t = uc.plan.months.flatMap((m) => m.tasks).find((x) => x.kind === pub.kind && !uc.doneKeys.has(x.key));
      if (t) await db.batch([[`INSERT INTO user_tasks(user_id,task_key,done,done_at) VALUES(?,?,1,datetime('now')) ON CONFLICT(user_id,task_key) DO UPDATE SET done=1, done_at=datetime('now')`, userId, t.key], ['UPDATE publications SET task_key=? WHERE id=?', t.key, pub.id]]);
    }
  }

  async function pubInput(body, userId) {
    const kind = PUB_KINDS.includes(body.kind) ? body.kind : null;
    if (!kind) throw bad('Nashr turini tanlang');
    const title = String(body.title || '').trim().slice(0, 300);
    if (title.length < 3) throw bad('Maqola/tezis sarlavhasini kiriting');
    const status = PUB_STATUS.includes(body.status) ? body.status : 'draft';
    const submitted_at = String(body.submitted_at || ''), published_at = String(body.published_at || '');
    if (!validDate(submitted_at) || !validDate(published_at)) throw bad('Sana YYYY-OO-KK ko‘rinishida bo‘lsin');
    const url = String(body.url || '').trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) throw bad('Havola http:// yoki https:// bilan boshlansin');
    let journal_id = null, journal_name = String(body.journal_name || '').trim().slice(0, 200);
    if (body.journal_id) {
      const j = await db.prepare('SELECT id, name FROM journals WHERE id=?').get(Number(body.journal_id));
      if (j) { journal_id = j.id; journal_name = j.name; }
    }
    return { kind, title, status, submitted_at, published_at, url, coauthors: String(body.coauthors || '').trim().slice(0, 300), note: String(body.note || '').trim().slice(0, 1000), journal_id, journal_name };
  }

  route('GET', '/api/publications', 'user', async (req, body, ctx) => {
    const profile = await db.prepare('SELECT degree FROM profiles WHERE user_id=?').get(ctx.user.id);
    const requirements = await db.prepare('SELECT * FROM requirements WHERE degree=? ORDER BY id').all(profile?.degree || 'phd');
    const s = await pubSummary(ctx.user.id, requirements);
    return { publications: s.pubs, byKind: s.byKind, totalNeeded: s.totalNeeded, publishedAll: s.publishedAll, slow: s.slow.map((p) => ({ id: p.id, title: p.title, weeks: p.weeks })) };
  });

  route('POST', '/api/publications', 'user', async (req, body, ctx) => {
    const p = await pubInput(body, ctx.user.id);
    const r = await db.prepare(`INSERT INTO publications(user_id,kind,title,journal_id,journal_name,status,submitted_at,published_at,url,coauthors,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .run(ctx.user.id, p.kind, p.title, p.journal_id, p.journal_name, p.status, p.submitted_at, p.published_at, p.url, p.coauthors, p.note);
    await syncPubTask(ctx.user.id, { id: r.lastInsertRowid, ...p, task_key: '' });
    return { ok: true, id: r.lastInsertRowid };
  });

  route('PUT', '/api/publications/(\\d+)', 'user', async (req, body, ctx) => {
    const id = Number(ctx.params[0]);
    const cur = await db.prepare('SELECT * FROM publications WHERE id=? AND user_id=?').get(id, ctx.user.id);
    if (!cur) throw new HttpError(404, 'Topilmadi');
    const p = await pubInput(body, ctx.user.id);
    await db.prepare(`UPDATE publications SET kind=?,title=?,journal_id=?,journal_name=?,status=?,submitted_at=?,published_at=?,url=?,coauthors=?,note=?,updated_at=datetime('now') WHERE id=? AND user_id=?`)
      .run(p.kind, p.title, p.journal_id, p.journal_name, p.status, p.submitted_at, p.published_at, p.url, p.coauthors, p.note, id, ctx.user.id);
    // Vazifa belgisi: tur yoki holat o'zgarsa eskisi qaytariladi, "chop etildi" bo'lsa mos vazifa belgilanadi
    const keep = cur.task_key && p.kind === cur.kind && p.status === 'published';
    if (cur.task_key && !keep) {
      await db.batch([['UPDATE user_tasks SET done=0, done_at=NULL WHERE user_id=? AND task_key=?', ctx.user.id, cur.task_key], ['UPDATE publications SET task_key=? WHERE id=?', '', id]]);
    }
    await syncPubTask(ctx.user.id, { id, ...p, task_key: keep ? cur.task_key : '' });
    return { ok: true };
  });

  route('DELETE', '/api/publications/(\\d+)', 'user', async (req, body, ctx) => {
    const id = Number(ctx.params[0]);
    const cur = await db.prepare('SELECT * FROM publications WHERE id=? AND user_id=?').get(id, ctx.user.id);
    if (!cur) throw new HttpError(404, 'Topilmadi');
    if (cur.task_key) await db.prepare('UPDATE user_tasks SET done=0, done_at=NULL WHERE user_id=? AND task_key=?').run(ctx.user.id, cur.task_key);
    await db.prepare('DELETE FROM publications WHERE id=? AND user_id=?').run(id, ctx.user.id);
    return { ok: true };
  });

  // ---------- Barcha jurnallarni qidirish (katalog) ----------
  route('GET', '/api/catalog', 'user', async (req, body, ctx) => {
    const { q = '', type = 'all', access = '', quartile = '' } = ctx.query;
    const page = Math.max(1, parseInt(ctx.query.page, 10) || 1), size = Math.min(50, parseInt(ctx.query.size, 10) || 30);
    const term = `%${q.trim().replace(/[%_]/g, '')}%`;
    let rows = q.trim()
      ? await db.prepare('SELECT * FROM journals WHERE name LIKE ? OR publisher LIKE ? OR subjects LIKE ? OR issn LIKE ? ORDER BY name').all(term, term, term, term)
      : await db.prepare('SELECT * FROM journals ORDER BY name').all();
    if (rec.CATEGORIES.includes(type)) rows = rows.filter((j) => rec.matchesCategory(j, type));
    if (['free', 'paid'].includes(access)) rows = rows.filter((j) => j.access === access);
    if (/^Q[1-4]$/.test(quartile)) rows = rows.filter((j) => j.quartile === quartile);
    const total = rows.length;
    const items = rows.slice((page - 1) * size, page * size).map((j) => ({ ...j, category: j.kind === 'conference' ? 'conference' : j.scopus_status !== 'none' ? 'scopus' : j.oak_status !== 'none' ? 'oak' : 'impact_lite' }));
    return { items, total, page, pages: Math.max(1, Math.ceil(total / size)) };
  });

  // ---------- Hisob: parolni o'zgartirish ----------
  route('POST', '/api/account/password', 'public', async (req, body, ctx) => {
    if (!ctx.user) throw new HttpError(401, 'Tizimga kiring');
    const u = await db.prepare('SELECT * FROM users WHERE id=?').get(ctx.user.id);
    if (!(await auth.verifyPassword(String(body.current || ''), u.pass_hash))) throw new HttpError(400, 'Joriy parol noto‘g‘ri');
    const pw = String(body.password || '');
    if (pw.length < 8) throw bad('Yangi parol kamida 8 belgidan iborat bo‘lsin');
    await db.batch([['UPDATE users SET pass_hash=? WHERE id=?', await auth.hashPassword(pw), u.id], ['DELETE FROM sessions WHERE user_id=? AND token != ?', u.id, ctx.token || '']]);
    return { ok: true };
  });

  route('GET', '/api/journals', 'user', async (req, body, ctx) => {
    const { category, access } = ctx.query;
    if (!rec.CATEGORIES.includes(category) || !['free', 'paid'].includes(access)) throw bad('category/access noto‘g‘ri');
    const r = await rec.ensureRecommendations(db, ctx.user.id, category, access);
    if (r.needProfile) return { needProfile: true };
    const items = await rec.list(db, ctx.user.id, category, access);
    const log = await db.prepare('SELECT summary, created_at FROM refresh_log WHERE user_id=? AND category=? AND access=? ORDER BY id DESC LIMIT 1').get(ctx.user.id, category, access);
    return { items, lastRefresh: log || null, ai: ai.enabled() };
  });

  route('POST', '/api/journals/refresh', 'user', async (req, body, ctx) => {
    const { category, access } = body;
    if (!rec.CATEGORIES.includes(category) || !['free', 'paid'].includes(access)) throw bad('category/access noto‘g‘ri');
    const res = await rec.refresh(db, ctx.user.id, category, access, { syncFeeds: () => feeds.syncConfiguredFeeds(db, { quiet: true }) });
    if (res.needProfile) throw bad('Avval profilni to‘ldiring');
    return res;
  });

  // Jurnal bo'yicha batafsil qo'llanma: ma'lumot + maqola tayyorlash tavsiyalari + yuborish bosqichlari
  route('GET', '/api/journals/(\\d+)/guide', 'user', async (req, body, ctx) => {
    const j = await db.prepare('SELECT * FROM journals WHERE id=?').get(Number(ctx.params[0]));
    if (!j) throw new HttpError(404, 'Jurnal topilmadi');
    const category = rec.CATEGORIES.includes(ctx.query.category) ? ctx.query.category : (j.kind === 'conference' ? 'conference' : 'scopus');
    const { profile, direction } = await rec.getProfileCtx(db, ctx.user.id);
    const fit = await db.prepare('SELECT fit_score, fit_text, flag, flag_reason FROM user_journals WHERE user_id=? AND journal_id=? AND category=?').get(ctx.user.id, j.id, category);
    const advice = await db.prepare('SELECT text FROM journal_advice WHERE user_id=? AND journal_id=?').get(ctx.user.id, j.id);
    return { journal: j, category, guide: buildGuide(j, { category, direction, fit }), flag: fit?.flag ? fit.flag_reason : null, advice: advice?.text || null, aiEnabled: ai.enabled(), hasProfile: !!profile };
  });

  // AI: foydalanuvchi mavzusiga moslashtirilgan jurnal bo'yicha maslahat (keshlanadi)
  route('POST', '/api/journals/(\\d+)/advice', 'user', async (req, body, ctx) => {
    if (!ai.enabled()) throw bad('AI kaliti o‘rnatilmagan (GEMINI_API_KEY)');
    const j = await db.prepare('SELECT * FROM journals WHERE id=?').get(Number(ctx.params[0]));
    if (!j) throw new HttpError(404, 'Jurnal topilmadi');
    const { profile, direction } = await rec.getProfileCtx(db, ctx.user.id);
    if (!profile) throw bad('Avval profilni to‘ldiring');
    const text = await ai.ask("Siz tajribali ilmiy maslahatchisiz. Faqat o'zbek tilida, aniq va amaliy yozing. Bilmagan faktlarni to'qimang; jurnalning rasmiy 'Guide for Authors' hujjati ustuvorligini eslatib o'ting.",
      `Tadqiqotchi yo'nalishi: ${direction?.code} ${direction?.name}. Mavzu: ${profile.topic}. Jurnal: ${j.name} (${j.publisher}; kvartil: ${j.quartile || 'yo\'q'}; teglar: ${j.subjects}). ` +
      `Shu jurnalga maqola yuborish uchun: 1) mavzuni jurnal doirasiga qanday moslashtirish, 2) maqolaning aniq sarlavha/tuzilma g'oyasi, 3) rad etilish xavflari va ularni kamaytirish — 6-8 qisqa band bilan yozing.`, { maxTokens: 700, timeoutMs: 40000 });
    if (!text) throw new HttpError(502, 'AI hozir javob bera olmadi, keyinroq urinib ko‘ring (admin panelida «AI ni sinash» xato sababini ko‘rsatadi)');
    await db.prepare('INSERT OR REPLACE INTO journal_advice(user_id,journal_id,text) VALUES(?,?,?)').run(ctx.user.id, j.id, text);
    return { advice: text };
  });

  route('GET', '/api/journals/history', 'user', async (req, body, ctx) => ({
    log: await db.prepare('SELECT category, access, summary, created_at FROM refresh_log WHERE user_id=? ORDER BY id DESC LIMIT 30').all(ctx.user.id),
  }));

  // ---------- Admin ----------
  async function coverage() {
    // har bir yo'nalish uchun har bir toifa/kirish turida nechta nomzod jurnal bor (kamida 10 ta bo'lishi kerak) — bitta so'rov bilan
    const [dirs, journals] = await Promise.all([db.prepare('SELECT * FROM directions ORDER BY code').all(), db.prepare('SELECT id,kind,access,scopus_status,oak_status,impact_factor,if_source,apc_usd,wos,subjects,quartile,acceptance FROM journals').all()]);
    return dirs.map((d) => {
      const row = { code: d.code, name: d.name };
      for (const c of rec.CATEGORIES) for (const a of ['free', 'paid']) row[`${c}_${a}`] = rec.candidatesFrom(journals, c, a, d, '').length;
      return row;
    });
  }

  route('GET', '/api/admin/stats', 'admin', async () => {
    const n = async (sql) => (await db.prepare(sql).get()).c;
    return {
      users: await n("SELECT COUNT(*) c FROM users WHERE role='user'"),
      profiles: await n('SELECT COUNT(*) c FROM profiles'),
      journals: await n('SELECT COUNT(*) c FROM journals'),
      unverified: await n('SELECT COUNT(*) c FROM journals WHERE verified=0'),
      scopus: await n("SELECT COUNT(*) c FROM journals WHERE scopus_status='active'"),
      oak: await n("SELECT COUNT(*) c FROM journals WHERE oak_status='active'"),
      ai: ai.enabled(), aiInfo: ai.info(),
      feeds: await feeds.feedStatus(db),
      coverage: await coverage(),
    };
  });

  route('GET', '/api/admin/users', 'admin', async () => {
    const [users, dirs, reqs, docTemplates, tasks] = await Promise.all([
      db.prepare(`SELECT u.id, u.login, u.full_name, u.created_at, p.direction_code, p.topic, p.months, p.status, p.degree, p.start_month
        FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.role='user' ORDER BY u.id DESC`).all(),
      db.prepare('SELECT * FROM directions').all(), db.prepare('SELECT * FROM requirements').all(), db.prepare('SELECT * FROM doc_templates ORDER BY id').all(),
      db.prepare('SELECT user_id, task_key FROM user_tasks WHERE done=1').all(),
    ]);
    const doneBy = new Map();
    for (const t of tasks) { if (!doneBy.has(t.user_id)) doneBy.set(t.user_id, new Set()); doneBy.get(t.user_id).add(t.task_key); }
    return {
      users: users.map((u) => {
        let progress = null;
        if (u.direction_code) {
          const c = buildContext({ months: u.months, start_month: u.start_month }, dirs.find((d) => d.code === u.direction_code), reqs.filter((r) => r.degree === u.degree), docTemplates, doneBy.get(u.id) || new Set());
          progress = c.progress.pct;
        }
        return { ...u, progress };
      }),
    };
  });

  route('POST', '/api/admin/users/(\\d+)/password', 'admin', async (req, body, ctx) => {
    const pw = String(body.password || '');
    if (pw.length < 8) throw bad('Parol kamida 8 belgidan iborat bo‘lsin');
    const id = Number(ctx.params[0]);
    const u = await db.prepare("SELECT id FROM users WHERE id=? AND role='user'").get(id);
    if (!u) throw new HttpError(404, 'Foydalanuvchi topilmadi');
    await db.batch([['UPDATE users SET pass_hash=? WHERE id=?', await auth.hashPassword(pw), id], ['DELETE FROM sessions WHERE user_id=?', id]]);
    return { ok: true };
  });

  route('DELETE', '/api/admin/users/(\\d+)', 'admin', async (req, body, ctx) => {
    await db.prepare("DELETE FROM users WHERE id=? AND role='user'").run(Number(ctx.params[0]));
    return { ok: true };
  });

  route('GET', '/api/admin/changes', 'admin', async () => ({
    changes: await db.prepare('SELECT c.*, j.name FROM journal_changes c JOIN journals j ON j.id=c.journal_id ORDER BY c.id DESC LIMIT 200').all(),
  }));

  const entity = (name) => { const e = ENTITIES[name]; if (!e) throw new HttpError(404, 'Topilmadi'); return e; };
  const entityData = (e, body) => { const data = {}; for (const c of e.cols) if (c in body) data[c] = coerce(c, body[c]); return data; };

  route('GET', '/api/admin/e/(\\w+)', 'admin', async (req, body, ctx) => {
    const e = entity(ctx.params[0]);
    const pk = e.pk || 'id';
    return { cols: e.cols, pk, rows: await db.prepare(`SELECT ${pk}, ${e.cols.filter((c) => c !== e.pk).join(',')} FROM ${e.table} ORDER BY ${e.order}`).all() };
  });

  route('POST', '/api/admin/e/(\\w+)', 'admin', async (req, body, ctx) => {
    const e = entity(ctx.params[0]);
    const data = entityData(e, body);
    if (!(data.name || data.title || data.code || data.text)) throw bad('Nom/sarlavha kiritilmagan');
    const keys = Object.keys(data);
    let r;
    try { r = await db.prepare(`INSERT INTO ${e.table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`).run(...keys.map((k) => data[k])); }
    catch (err) { if (/UNIQUE|constraint/i.test(String(err.message))) throw bad('Bunday yozuv allaqachon mavjud'); throw err; }
    if (e.table === 'journals') await rec.logChange(db, r.lastInsertRowid, 'created', '', data.name, 'admin');
    return { ok: true, id: r.lastInsertRowid };
  });

  route('PUT', '/api/admin/e/(\\w+)/([^/]+)', 'admin', async (req, body, ctx) => {
    const e = entity(ctx.params[0]);
    const pk = e.pk || 'id';
    const id = e.pk ? decodeURIComponent(ctx.params[1]) : Number(ctx.params[1]);
    const data = entityData(e, body);
    delete data[pk];
    const before = await db.prepare(`SELECT * FROM ${e.table} WHERE ${pk}=?`).get(id);
    if (!before) throw new HttpError(404, 'Topilmadi');
    const keys = Object.keys(data);
    if (!keys.length) return { ok: true };
    const extra = e.table === 'journals' ? ", updated_at=datetime('now')" : '';
    const stmts = [[`UPDATE ${e.table} SET ${keys.map((k) => `${k}=?`).join(',')}${extra} WHERE ${pk}=?`, ...keys.map((k) => data[k]), id]];
    if (e.track) for (const k of e.track) if (k in data && String(before[k] ?? '') !== String(data[k] ?? '')) stmts.push(rec.changeStmt(id, k, before[k], data[k], 'admin'));
    await db.batch(stmts);
    return { ok: true };
  });

  route('DELETE', '/api/admin/e/(\\w+)/([^/]+)', 'admin', async (req, body, ctx) => {
    const e = entity(ctx.params[0]);
    const pk = e.pk || 'id';
    await db.prepare(`DELETE FROM ${e.table} WHERE ${pk}=?`).run(e.pk ? decodeURIComponent(ctx.params[1]) : Number(ctx.params[1]));
    return { ok: true };
  });

  // Fid yuklash: CSV/JSON matn
  route('POST', '/api/admin/import', 'admin', async (req, body) => {
    const source = body.source === 'oak' ? 'oak' : 'scopus';
    const content = String(body.content || '');
    if (source === 'scopus' && feeds.isScimagoCsv(content)) {
      // SCImago to'liq CSV (~15 MB): faqat bazadagi jurnallar ajratib olinadi
      let r; try { r = await feeds.applyScimagoText(db, content); } catch (e) { throw bad(`SCImago faylini o'qib bo'lmadi: ${e.message}`); }
      return { ok: true, total: r.rows, stats: r.stats, text: r.text };
    }
    let items;
    try { items = feeds.parseFeed(content); } catch (e) { throw bad(`Faylni o'qib bo'lmadi: ${e.message}`); }
    if (!items.length) throw bad('Faylda yozuv topilmadi');
    const stats = await feeds.applyFeed(db, items, source, { mode: body.full ? 'full' : 'delta', addNew: !!body.addNew });
    return { ok: true, total: items.length, stats, text: feeds.describe(stats) };
  });

  route('POST', '/api/admin/ai-test', 'admin', async () => ai.test());

  route('POST', '/api/admin/sync', 'admin', async () => {
    const msg = await feeds.syncConfiguredFeeds(db, { force: true });
    return { ok: true, message: msg || 'Avtomatik yuklash o‘chirilgan (FEEDS_AUTO=0) yoki manbalar o‘chirilgan.' };
  });

  route('POST', '/api/admin/ai-import', 'admin', async (req, body) => {
    if (!ai.enabled()) throw bad('AI kaliti o‘rnatilmagan (GEMINI_API_KEY)');
    const arr = await ai.extractJournals(String(body.content || ''), body.source === 'oak' ? "OAK tomonidan e'tirof etilgan jurnallar ro'yxati" : 'Scopus jurnallari');
    if (!Array.isArray(arr) || !arr.length) throw bad('AI hech narsa ajrata olmadi');
    const items = arr.map(feeds.normalizeItem);
    const stats = await feeds.applyFeed(db, items, body.source === 'oak' ? 'oak' : 'scopus', { mode: 'delta', addNew: true });
    return { ok: true, total: items.length, stats, text: feeds.describe(stats) };
  });

  // ---------- HTTP qatlami (Web standart) ----------
  const SEC = {
    'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'same-origin', 'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
  };

  function parseCookies(h) {
    return Object.fromEntries(String(h || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), c.slice(i + 1)]; }));
  }

  async function readBody(request) {
    const text = await request.text();
    if (text.length > 40e6) throw new HttpError(413, 'Hajm juda katta (40 MB dan oshmasin)');
    if (!text) return {};
    try { return JSON.parse(text); } catch { throw bad('JSON noto‘g‘ri'); }
  }

  return async function handle(request) {
    const url = new URL(request.url);
    const headers = new Headers({ ...SEC, 'content-type': 'application/json; charset=utf-8' });
    const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers });
    try {
      const cookies = parseCookies(request.headers.get('cookie'));
      const secure = url.protocol === 'https:' ? '; Secure' : '';
      const ctx = {
        token: cookies.sid, user: await auth.userFromToken(db, cookies.sid), query: Object.fromEntries(url.searchParams), params: [],
        ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local',
        setCookie: ({ token, maxAge }) => headers.append('set-cookie', `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`),
        clearCookie: () => headers.append('set-cookie', `sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`),
      };
      for (const r of routes) {
        if (r.method !== request.method) continue;
        const m = url.pathname.match(r.re);
        if (!m) continue;
        ctx.params = m.slice(1);
        if (r.access !== 'public' && !ctx.user) throw new HttpError(401, 'Tizimga kiring');
        if (r.access === 'admin' && ctx.user.role !== 'admin') throw new HttpError(403, 'Ruxsat yo‘q');
        if (r.access === 'user' && ctx.user.role !== 'user') throw new HttpError(403, 'Bu bo‘lim tadqiqotchilar uchun');
        let body = {};
        if (request.method !== 'GET') {
          if (!String(request.headers.get('content-type') || '').includes('application/json') && Number(request.headers.get('content-length') || 0) > 0) throw new HttpError(415, 'application/json kerak');
          body = await readBody(request);
        }
        return json(200, await r.handler(request, body, ctx));
      }
      throw new HttpError(404, 'Topilmadi');
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      console.error(e);
      return json(500, { error: 'Ichki xatolik' });
    }
  };
}

module.exports = { createHandler };

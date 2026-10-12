'use strict';
process.env.FEEDS_AUTO = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const I18N = require('../public/i18n.js');
const { open } = require('../src/db-node');
const { initSchema } = require('../src/db');
const { seedAll } = require('../src/seed');
const { createApp } = require('../server');

const T = I18N.createTranslator([require('../public/i18n-ru-ui.js'), require('../public/i18n-ru-content.js'), require('../public/i18n-ru-data.js')]);

test('tarjimon: aniq moslik, andoza, bo‘laklash, apostrof variantlari, bo‘shliq', () => {
  assert.equal(T.tr('Saqlash'), 'Сохранить');
  assert.equal(T.tr('  Saqlash  '), '  Сохранить  ');                       // bo'shliq saqlanadi
  assert.equal(T.tr("Profilni to'ldirish"), 'Заполнить профиль');
  assert.equal(T.tr('Profilni toʻldirish'), 'Заполнить профиль');            // ʻ variant
  assert.equal(T.tr('Xush kelibsiz, Ali!'), 'Добро пожаловать, Ali!');       // andoza
  assert.equal(T.tr('Yanvar 2027'), 'Январь 2027');
  assert.equal(T.tr('Elsevier, Birlashgan Qirollik'), 'Elsevier, Великобритания'); // ro'yxat bo'laklari
  assert.equal(T.tr('education, pedagogy'), 'образование, педагогика');
  assert.equal(T.tr('Noma’lum matn'), 'Noma’lum matn');                       // lug'atda yo'q — o'zgarmaydi
  assert.equal(T.tr('Журнал'), 'Журнал');
  assert.deepEqual(T.deep({ a: ['Saqlash', { b: 'Bekor qilish' }], n: 5, z: null }), { a: ['Сохранить', { b: 'Отмена' }], n: 5, z: null });
});

// O'zbekcha matn belgilari (lotin harfli, ruscha emas)
const UZ = /[ʻ‘’]|\b(va|bilan|uchun|ning|dan|lar|ham|yoki|kerak|hamda|qilish|etish|bo'l\w*|bo‘l\w*|ta'lim|oy|yil|kun|hafta|bosqich|jurnal\w*|maqola\w*|tezis\w*|talab\w*|reja\w*|vazifa\w*|ilmiy|nashr\w*)\b|[a-z]'[a-z]/i;
const SKIP_KEYS = new Set(['name', 'publisher', 'journal_name', 'full_name', 'login', 'topic', 'title_user', 'issn', 'official_url', 'scopus_url', 'oak_url', 'url', 'subjects', 'fit_text_skip', 'created_at', 'added_at', 'updated_at', 'at', 'label_skip', 'author_skip', 'start_month', 'status', 'kind', 'category', 'key', 'task_key', 'taskKey', 'docKey', 'flag', 'note_skip', 'access', 'degree', 'code', 'field_group_skip', 'tags', 'scopus_status', 'oak_status', 'quartile', 'if_source', 'direction_code', 'level']);

const CYR = /[А-Яа-яЁё]/;
const isUz = (v) => !/^https?:/.test(v) && (CYR.test(v) ? new RegExp(UZ.source.replace('[ʻ‘’]|', ''), 'i').test(v) : UZ.test(v));
function collect(v, path, out, key) {
  if (typeof v === 'string') { if (!SKIP_KEYS.has(key) && isUz(v)) out.push(`${path}: ${v.slice(0, 160)}`); }
  else if (Array.isArray(v)) v.forEach((x, i) => collect(x, `${path}[${i}]`, out, key));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) collect(x, `${path}.${k}`, out, k);
}

function client(base, lang) {
  let cookie = lang ? `lang=${lang}` : '';
  return async (method, path, body, raw) => {
    const res = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.getSetCookie?.().find((c) => c.startsWith('sid='));
    if (sc) cookie = `${lang ? `lang=${lang}; ` : ''}${sc.split(';')[0]}`;
    if (raw) return res;
    return { status: res.status, data: await res.json() };
  };
}

test('rus rejimi: barcha foydalanuvchi API javoblarida o‘zbekcha matn qolmagan', async (t) => {
  delete process.env.GEMINI_API_KEY; delete process.env.OPENAI_API_KEY; delete process.env.ANTHROPIC_API_KEY; delete process.env.API_KEY;
  const db = open(':memory:'); await initSchema(db); await seedAll(db);
  const server = createApp(db).listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const ru = client(base, 'ru'), uz = client(base, null);
  const bad = [];
  const check = (label, data) => collect(data, label, bad, '');

  // xatolar (kirishdan oldin)
  check('login-xato', (await ru('POST', '/login', { login: 'yoq', password: 'xxxxxxxx' })).data);
  check('register-xato', (await ru('POST', '/register', { login: 'a', password: 'x', full_name: 'Y' })).data);
  check('401', (await ru('GET', '/dashboard')).data);
  assert.equal((await ru('POST', '/register', { login: 'rus1', password: 'password1', full_name: 'Дилшод Рафиддинович' })).status, 200);
  check('meta', (await ru('GET', '/meta')).data);
  check('knowledge', (await ru('GET', '/knowledge')).data);
  check('403', (await ru('GET', '/admin/stats')).data);

  check('profile-xato', (await ru('PUT', '/profile', { status: 'doctoral', degree: 'phd', direction_code: 'yoq', topic: 'mavzu mavzu', months: 6 })).data);
  assert.equal((await ru('PUT', '/profile', { status: 'doctoral', degree: 'phd', direction_code: '13.00.05', topic: 'Методика развития цифровых компетенций у студентов колледжей', months: 6, start_month: '2027-01' })).status, 200);
  check('dashboard', (await ru('GET', '/dashboard')).data);
  check('plan', (await ru('GET', '/plan')).data);
  check('documents', (await ru('GET', '/documents')).data);
  await ru('PUT', '/profile', { status: 'doctoral', degree: 'phd', direction_code: '08.00.17', topic: 'Цифровой маркетинг в туризме и гостиничной деятельности', months: 12, start_month: '2026-10' });
  check('plan-yangi-tartib', (await ru('GET', '/plan')).data);
  check('documents-yangi', (await ru('GET', '/documents')).data);
  check('dashboard2', (await ru('GET', '/dashboard')).data);

  // nashrlar va dissertatsiya
  check('pub-xato', (await ru('POST', '/publications', { kind: 'oak', title: 'a' })).data);
  await ru('POST', '/publications', { kind: 'oak', title: 'Моя статья', status: 'submitted', submitted_at: '2020-01-01', journal_name: 'X' });
  check('publications', (await ru('GET', '/publications')).data);
  check('dashboard-slow', (await ru('GET', '/dashboard')).data);
  check('thesis', (await ru('GET', '/thesis')).data);
  for (const k of ['dolzarb', 'maqsad', 'vazifalar', 'yangilik', 'aprobatsiya']) check(`draft-${k}`, (await ru('POST', `/thesis/intro/${k}/draft`, {})).data);
  check('ideas', (await ru('POST', '/thesis/ideas', {})).data);
  check('chapter-xato', (await ru('POST', '/thesis/chapters', { title: 'X' })).data);

  // jurnallar: barcha toifalar, yangilash, qo'llanma
  const seen = [];
  for (const cat of ['scopus', 'oak', 'impact', 'impact_lite', 'conference']) for (const acc of ['free', 'paid']) {
    const r = (await ru('GET', `/journals?category=${cat}&access=${acc}`)).data;
    check(`journals-${cat}-${acc}`, r.items.map(({ name, ...rest }) => rest));
    if (r.items[0]) seen.push([cat, r.items[0].id]);
    if (r.items[3]) seen.push([cat, r.items[3].id]);
  }
  check('refresh', (await ru('POST', '/journals/refresh', { category: 'scopus', access: 'free' })).data);
  for (const [cat, id] of seen) check(`guide-${cat}-${id}`, (await ru('GET', `/journals/${id}/guide?category=${cat}`)).data);
  check('catalog', (await ru('GET', '/catalog?q=tourism&size=5')).data);
  // "chiqib ketgan" jurnal va OAK'dan chiqarilgan: ogohlantirishlar
  await db.prepare("UPDATE journals SET scopus_status='discontinued', verified=0 WHERE name='Tourism Management'").run();
  const sc = (await ru('GET', '/journals?category=scopus&access=free')).data.items.find((j) => j.name === 'Tourism Management');
  if (sc) check('guide-discontinued', (await ru('GET', `/journals/${sc.id}/guide?category=scopus`)).data);
  await ru('POST', '/journals/refresh', { category: 'scopus', access: 'free' });
  check('journals-flagged', (await ru('GET', '/journals?category=scopus&access=free')).data.items.map(({ name, ...r }) => r));
  check('dashboard-flag', (await ru('GET', '/dashboard')).data);
  check('advice-xato', (await ru('POST', `/journals/${seen[0][1]}/advice`, {})).data);

  // kalendar
  const ics = await (await ru('GET', '/plan.ics', null, true)).text();
  assert.match(ics, /месяц\\, срок/);
  if (UZ.test(ics.replace(/UID:[^\r]*/g, '').replace(/PRODID[^\r]*/, ''))) bad.push(`ics: ${ics.split('\r\n').filter((l) => UZ.test(l) && !/^(UID|PRODID)/.test(l)).slice(0, 3).join(' | ')}`);

  // o'zbekcha rejim o'zgarmaydi
  const dz = (await uz('POST', '/login', { login: 'rus1', password: 'password1' })).status;
  assert.equal(dz, 200);
  assert.match((await uz('GET', '/dashboard')).data.motivation, /^Hurmatli/);
  assert.match((await ru('GET', '/dashboard')).data.motivation, /^Уважаемый/);

  const uniq = [...new Set(bad)];
  assert.equal(uniq.length, 0, `Tarjima qilinmagan ${uniq.length} ta matn:\n${uniq.slice(0, 60).join('\n')}`);
});

test('boshlang‘ich ma‘lumotlar: barcha yo‘nalish, hujjat, talab, iqtibos va jurnal maydonlari tarjima qilingan', () => {
  const seed = require('../src/seed');
  const left = [];
  const chk = (label, v) => { if (typeof v === 'string' && v) { const r = T.tr(v); if (isUz(r) && !/^https?:/.test(v)) left.push(`${label}: ${v.slice(0, 100)}`); } };
  for (const d of seed.directions) { chk(`dir ${d.code} name`, d.name); chk(`dir ${d.code} group`, d.field_group); String(d.hints || '').split('|').forEach((h) => chk(`dir ${d.code} hint`, h)); }
  for (const [key, , title, desc] of seed.docs) { chk(`doc ${key} title`, title); chk(`doc ${key} desc`, desc); }
  for (const r of seed.requirements) { chk(`req ${r.kind} title`, r.title); chk(`req ${r.kind} desc`, r.description); }
  for (const q of seed.quotes) q.forEach((x, i) => chk(`quote ${i}`, x));
  for (const j of seed.journals) { chk(`j ${j.name} publisher`, j.publisher); chk(`j ${j.name} country`, j.country); chk(`j ${j.name} desc`, j.description); String(j.subjects || '').split(',').forEach((x) => chk(`j ${j.name} tag`, x)); if (j.kind === 'conference') chk(`conf name`, j.name); }
  const { INTRO_BANDS, defaultChapters } = require('../src/thesis');
  INTRO_BANDS.forEach((b) => { chk(`band ${b.key}`, b.title); chk(`band ${b.key} hint`, b.hint); });
  ['phd', 'dsc'].forEach((deg) => defaultChapters(deg).forEach(([t]) => chk(`chapter ${deg}`, t)));
  const { knowledge } = require('../src/knowledge');
  chk('knowledge warning', knowledge.warning);
  knowledge.sections.forEach((s) => { chk('section', s.title); s.items.forEach((i) => chk('item', i)); });
  knowledge.links.forEach(([t]) => chk('link', t));
  const uniq = [...new Set(left)];
  assert.equal(uniq.length, 0, `Tarjima qilinmagan ${uniq.length} ta:\n${uniq.slice(0, 40).join('\n')}`);
});

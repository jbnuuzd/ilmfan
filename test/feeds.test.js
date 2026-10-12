'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { open } = require('../src/db-node');
const { initSchema } = require('../src/db');
const { seedAll } = require('../src/seed');
const feeds = require('../src/feeds');
const { parseXlsx } = require('../src/xlsx');

const XLSX = fs.readFileSync(path.join(__dirname, 'fixtures', 'discontinued.xlsx'));

function scimagoCsv() {
  const head = 'Rank;Sourceid;Title;Type;Issn;Publisher;SJR;SJR Best Quartile;H index';
  const rows = [
    '1;1;"Computers and Education";journal;"03601315, 18731791";Elsevier;3,2;Q2;200',          // seed: "Computers & Education" Q1 -> Q2
    '2;2;"Cypriot Journal of Educational Sciences";journal;"13023059";Birlik;0,4;Q3;10',          // chiqarilganlar ro'yxatida ham bor
    '3;3;"Tourism Management";journal;"02615177";Elsevier;4,1;Q1;250',
    '4;4;"Boshqa jurnal; nuqtali vergul bilan";journal;"11111111";X;0,1;Q4;1',
  ];
  for (let i = 0; i < 150; i++) rows.push(`${i + 5};${i + 5};"Filler Journal ${i}";journal;"${String(20000000 + i)}";Pub;0,1;Q4;1`);
  return [head, ...rows].join('\n');
}

function mockFetch(handlers) {
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    for (const [re, fn] of handlers) if (re.test(String(url))) return fn();
    return new Response('Not found', { status: 404 });
  };
  return calls;
}

async function freshDb() { const db = open(':memory:'); await initSchema(db); await seedAll(db); return db; }
const q = (db, name) => db.prepare('SELECT * FROM journals WHERE name=?').get(name);

test('xlsx o‘qigich: sarlavhali varaq, ISSN, XML belgilari', async () => {
  const sheets = await parseXlsx(XLSX);
  assert.equal(sheets.length, 2);
  assert.deepEqual(sheets[0][1], ['Source Title', 'ISSN', 'E-ISSN', 'Publisher', 'Discontinued reason']);
  assert.ok(sheets[0].some((r) => r[0] === 'Fake & Predatory <Journal>'));
  const items = await feeds.parseDiscontinuedXlsx(XLSX);
  assert.equal(items.length, 3);
  assert.deepEqual(items[1].issns, ['12345678', '87654321']);
  assert.ok(items.every((i) => i.scopus_status === 'discontinued'));
});

test('SCImago skaneri: faqat bazadagi jurnallar, "&" va "and" mosligi, ustun tekshiruvi', () => {
  const names = new Set(['computers and education', 'tourism management']);
  const { items, rows } = feeds.scanScimago(scimagoCsv(), names, new Set());
  assert.equal(rows, 154);
  assert.deepEqual(items.map((i) => [i.name, i.quartile]), [['Computers and Education', 'Q2'], ['Tourism Management', 'Q1']]);
  assert.deepEqual(items[0].issns, ['03601315', '18731791']);
  assert.throws(() => feeds.scanScimago('A;B\n1;2', names, new Set()), /ustunlari topilmadi/);
  assert.throws(() => feeds.scanScimago('Title;Issn;SJR Best Quartile\nX;11111111;Q1', names, new Set()), /juda qisqa/);
});

test('avtomatik sinxronlash: kvartil o‘zgaradi, chiqarilgan jurnal belgilanadi va qayta faollashmaydi', async () => {
  delete process.env.SCOPUS_FEED_URL; delete process.env.SCOPUS_DISCONTINUED_URL; delete process.env.FEEDS_AUTO;
  const realFetch = global.fetch;
  try {
    const db = await freshDb();
    const calls = mockFetch([
      [/scimagojr\.com/, () => new Response(scimagoCsv(), { status: 200 })],
      [/oak\.uz.*Discontinued/, () => new Response(XLSX, { status: 200 })],
      [/oak\.uz\/pages\/31738/, () => new Response('<!DOCTYPE html><html><body><a href="/userfiles/files/royxat.csv">Ro\'yxat</a><a href="/userfiles/files/2%20Discontinued-sources.xlsx">x</a></body></html>', { status: 200 })],
      [/royxat\.csv/, () => new Response('name,issn,publisher\nComputers & Education,0360-1315,Elsevier Science Publishers\n', { status: 200 })],
    ]);
    const msg = await feeds.syncConfiguredFeeds(db, { force: true });
    assert.match(msg, /SCImago/); assert.match(msg, /chiqarilgan/); assert.match(msg, /OAK ro'yxati: 1 ta yozuv/);
    assert.equal(calls.length, 4);   // scimago, discontinued, OAK sahifasi, sahifadagi CSV (discontinued havola o'tkazib yuboriladi)
    assert.equal((await q(db, 'Computers & Education')).quartile, 'Q2');
    assert.equal((await q(db, 'Computers & Education')).issn, '03601315');           // ISSN to'ldirildi
    assert.equal((await q(db, 'Cypriot Journal of Educational Sciences')).scopus_status, 'discontinued');
    assert.equal((await q(db, 'Universal Journal of Educational Research')).scopus_status, 'discontinued');
    const changes = await db.prepare("SELECT field, old_value, new_value, source FROM journal_changes WHERE field='quartile' AND new_value='Q2'").all();
    assert.ok(changes.some((c) => c.old_value === 'Q1' && c.source === 'feed:scopus'));

    // SCImago qayta yuklanganda "discontinued" qayta "active" bo'lmaydi
    await feeds.syncConfiguredFeeds(db, { force: true });
    assert.equal((await q(db, 'Cypriot Journal of Educational Sciences')).scopus_status, 'discontinued');

    // TTL: yaqinda yuklangan — qayta yuklanmaydi
    calls.length = 0;
    assert.equal(await feeds.syncConfiguredFeeds(db), null);
    assert.equal(calls.length, 0);

    const st = await feeds.feedStatus(db);
    assert.ok(st.find((s) => s.key === 'scimago').last.ok && st.find((s) => s.key === 'discontinued').last.ok);
    assert.ok(st.find((s) => s.key === 'oak').last.ok);   // OAK sahifasi kuzatildi
  } finally { global.fetch = realFetch; }
});

test('avtomatik sinxronlash: sayt bloklasa/HTML bersa — xato xabari, ma‘lumotga tegilmaydi', async () => {
  delete process.env.FEEDS_AUTO;
  const realFetch = global.fetch;
  try {
    const db = await freshDb();
    mockFetch([[/scimagojr\.com/, () => new Response('<!DOCTYPE html><html><body>Access denied</body></html>', { status: 200 })], [/oak\.uz/, () => new Response('Forbidden', { status: 403 })]]);
    const msg = await feeds.syncConfiguredFeeds(db, { force: true });
    assert.match(msg, /HTML/); assert.match(msg, /HTTP 403/);
    assert.equal((await q(db, 'Computers & Education')).quartile, 'Q1');
    const st = await feeds.feedStatus(db);
    assert.equal(st.find((s) => s.key === 'scimago').last.ok, false);
    // xato bo'lsa 6 soat ichida qayta urinilmaydi
    const calls = mockFetch([]);
    assert.equal(await feeds.syncConfiguredFeeds(db), null); assert.equal(calls.length, 0);
  } finally { global.fetch = realFetch; }
});

test('sozlamalar: FEEDS_AUTO=0, "off", maxsus manzil', () => {
  process.env.FEEDS_AUTO = '0'; assert.equal(feeds.sourceUrl('scimago'), null); delete process.env.FEEDS_AUTO;
  process.env.SCOPUS_FEED_URL = 'off'; assert.equal(feeds.sourceUrl('scimago'), null);
  process.env.SCOPUS_FEED_URL = 'https://example.com/x.csv'; assert.equal(feeds.sourceUrl('scimago'), 'https://example.com/x.csv');
  delete process.env.SCOPUS_FEED_URL;
  assert.match(feeds.sourceUrl('scimago'), /scimagojr\.com/); assert.match(feeds.sourceUrl('discontinued'), /Discontinued-sources/);
});

test('ishonchli moslashtirish: umumiy nom avtomatik qo‘llanmaydi, ISSN — hakam, nomdosh jurnal adashtirilmaydi', async () => {
  const db = await freshDb();
  const disc = (name, issns) => ({ name, issn: issns[0] || '', issns, quartile: '', scopus_status: 'discontinued', oak_status: '', publisher: '', subjects: '', access: '' });
  // 1) "Energy" — 1 so'zli nom, bazada ISSN yo'q: avtomatik belgilanmaydi, "tekshirish" ro'yxatiga tushadi
  let st = await feeds.applyFeed(db, [disc('Energy', ['11111111'])], 'scopus', { nameOnlyMinWords: 3, fillIssn: false });
  assert.deepEqual(st.review, ['Energy']);
  assert.equal((await q(db, 'Energy')).scopus_status, 'active');
  assert.equal((await q(db, 'Energy')).issn, '');
  assert.match(feeds.describe(st), /ISSN kerak\): Energy/);
  // 2) Bazada ISSN bor: boshqa ISSN — nomdosh boshqa jurnal, tegilmaydi
  await db.prepare("UPDATE journals SET issn='03605442' WHERE name='Energy'").run();
  st = await feeds.applyFeed(db, [disc('Energy', ['99999999'])], 'scopus', { nameOnlyMinWords: 3, fillIssn: false });
  assert.equal(st.updated, 0); assert.equal((await q(db, 'Energy')).scopus_status, 'active');
  // 3) ISSN mos: nom qisqa bo'lsa ham ishonchli
  st = await feeds.applyFeed(db, [disc('Energy (old title)', ['03605442'])], 'scopus', { nameOnlyMinWords: 3, fillIssn: false });
  assert.equal(st.updated, 1); assert.equal((await q(db, 'Energy')).scopus_status, 'discontinued');
  // 4) Uzun (>=3 so'z) nom bo'yicha belgilanadi, lekin chiqarilganlar ro'yxatidan ISSN kiritilmaydi
  st = await feeds.applyFeed(db, [disc('Education Sciences Journal Extra', ['22222222']), disc('Educational Research Review', ['22222222'])], 'scopus', { nameOnlyMinWords: 3, fillIssn: false });
  assert.equal((await q(db, 'Educational Research Review')).scopus_status, 'discontinued');
  assert.equal((await q(db, 'Educational Research Review')).issn, '');
});

test('migratsiya v4: eski noto‘g‘ri (umumiy nomli) "chiqib ketgan" belgilari qaytariladi', async () => {
  const db = await freshDb();
  const { setSetting } = require('../src/db');
  const bad = await q(db, 'Medicine'), good = await q(db, 'Cypriot Journal of Educational Sciences');
  for (const [j, issn] of [[bad, '00257974'], [good, '13023059']]) {
    await db.prepare("UPDATE journals SET scopus_status='discontinued', issn=? WHERE id=?").run(issn, j.id);
    await db.prepare("INSERT INTO journal_changes(journal_id,field,old_value,new_value,source) VALUES(?,'scopus_status','active','discontinued','feed:scopus')").run(j.id);
    await db.prepare("INSERT INTO journal_changes(journal_id,field,old_value,new_value,source) VALUES(?,'issn','',?,'feed:scopus')").run(j.id, issn);
  }
  await db.prepare("INSERT INTO users(login,pass_hash,role,full_name) VALUES('u','x','user','U')").run();
  await db.prepare("INSERT INTO user_journals(user_id,journal_id,category,access,flag,flag_reason) VALUES(1,?,'scopus','paid','delisted','x')").run(bad.id);
  await setSetting(db, 'seed_version', '3');
  await seedAll(db);
  const b = await q(db, 'Medicine'), g = await q(db, 'Cypriot Journal of Educational Sciences');
  assert.equal(b.scopus_status, 'active'); assert.equal(b.issn, '');
  assert.equal(g.scopus_status, 'discontinued'); // >=3 so'zli nom — qoladi
  assert.equal((await db.prepare('SELECT flag FROM user_journals WHERE journal_id=?').get(bad.id)).flag, '');
  assert.ok(await db.prepare("SELECT 1 x FROM journal_changes WHERE journal_id=? AND source='migration'").get(bad.id));
});

test('admin importi: SCImago to‘liq CSV tez skaner orqali qo‘llanadi', async () => {
  const db = await freshDb();
  const r = await feeds.applyScimagoText(db, scimagoCsv());
  assert.equal(r.rows, 154); assert.ok(feeds.isScimagoCsv(scimagoCsv()));
  assert.equal((await q(db, 'Computers & Education')).quartile, 'Q2');
  assert.ok(!feeds.isScimagoCsv('name,issn\nX,1'));
});

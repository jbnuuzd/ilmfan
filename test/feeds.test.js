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
    ]);
    const msg = await feeds.syncConfiguredFeeds(db, { force: true });
    assert.match(msg, /SCImago/); assert.match(msg, /chiqarilgan/);
    assert.equal(calls.length, 2);
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
    assert.equal(st.find((s) => s.key === 'oak').enabled, false); // OAK uchun standart manba yo'q
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

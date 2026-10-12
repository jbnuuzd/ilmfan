'use strict';
process.env.FEEDS_AUTO = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('../src/db-node');
const { initSchema } = require('../src/db');
const { seedAll } = require('../src/seed');
const auth = require('../src/auth');
const { createApp } = require('../server');

function client(base) {
  let cookie = '';
  return async (method, path, body, raw) => {
    const res = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    if (raw) return res;
    return { status: res.status, data: await res.json() };
  };
}

test('saqlangan jurnallar, admin tahlili va CSV eksport', async (t) => {
  const db = open(':memory:'); await initSchema(db); await seedAll(db);
  await auth.ensureAdmin(db, { ADMIN_LOGIN: 'boss', ADMIN_PASSWORD: 'S3cret-pass' }, { log: () => {} });
  const server = createApp(db).listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const u = client(base), v = client(base), a = client(base);
  await u('POST', '/register', { login: 'bk1', password: 'password1', full_name: 'Saqlovchi Odam' });
  await v('POST', '/register', { login: 'bk2', password: 'password1', full_name: 'Boshqa Odam' });
  await u('PUT', '/profile', { status: 'doctoral', degree: 'phd', direction_code: '13.00.05', topic: 'Kasb-hunar ta’limi metodikasi', months: 6, start_month: '2027-01' });

  const items = (await u('GET', '/journals?category=scopus&access=free')).data.items;
  assert.ok(items.every((j) => j.bookmarked === false));
  const j1 = items[0], j2 = items[1];
  assert.equal((await u('PUT', `/bookmarks/${j1.id}`, { note: 'Q1, tez yozish kerak' })).status, 200);
  assert.equal((await u('PUT', `/bookmarks/${j2.id}`, {})).status, 200);
  assert.equal((await u('PUT', '/bookmarks/999999', {})).status, 404);
  assert.equal((await u('PUT', `/bookmarks/${j1.id}`, { note: 'yangilandi' })).status, 200);       // yangilash, takrorlanmaydi
  const bm = (await u('GET', '/bookmarks')).data.items;
  assert.equal(bm.length, 2);
  assert.equal(bm.find((x) => x.id === j1.id).note, 'yangilandi');
  assert.ok(bm.every((x) => x.bookmarked && x.category === 'scopus' && x.name));
  assert.ok((await u('GET', '/journals?category=scopus&access=free')).data.items.find((j) => j.id === j1.id).bookmarked);
  assert.ok((await u('GET', `/catalog?q=${encodeURIComponent(j1.name.slice(0, 12))}`)).data.items.find((j) => j.id === j1.id).bookmarked);
  assert.equal((await v('GET', '/bookmarks')).data.items.length, 0);                                // boshqa foydalanuvchida yo'q
  assert.equal((await u('DELETE', `/bookmarks/${j2.id}`)).status, 200);
  assert.equal((await u('GET', '/bookmarks')).data.items.length, 1);

  // Admin tahlili
  assert.equal((await u('GET', '/admin/analytics')).status, 403);
  await a('POST', '/login', { login: 'boss', password: 'S3cret-pass' });
  const an = (await a('GET', '/admin/analytics')).data;
  assert.equal(an.totals.users, 2); assert.equal(an.totals.profiles, 1); assert.equal(an.totals.bookmarks, 1);
  assert.deepEqual(an.byDirection, [{ code: '13.00.05', c: 1 }]);
  assert.equal(an.byStatus[0].status, 'doctoral');
  assert.ok(an.weeks.length >= 1 && an.weeks.reduce((s, w) => s + w.c, 0) === 2);
  assert.equal(typeof an.avgProgress, 'number');

  // CSV eksport
  const csv = await a('GET', '/admin/export/journals.csv', null, true);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.headers.get('content-disposition'), /jurnallar\.csv/);
  const buf = Buffer.from(await csv.arrayBuffer());
  assert.deepEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf]); // Excel uchun UTF-8 BOM
  const text = buf.toString('utf8').replace(/^\ufeff/, '');
  assert.ok(text.startsWith('id,name,'));
  assert.ok(text.split('\r\n').length > 250);
  assert.ok(text.includes('"Computers & Education"') || text.includes('Computers & Education'));
  assert.equal((await u('GET', '/admin/export/journals.csv', null, true)).status, 403);
});

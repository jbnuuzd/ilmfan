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
  return async (method, path, body) => {
    const res = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    return { status: res.status, data: await res.json() };
  };
}

test('nashrlarim: holatlar, talablar hisobi, vazifani avtomatik belgilash, eslatma', async (t) => {
  const db = open(':memory:'); await initSchema(db); await seedAll(db);
  await auth.ensureAdmin(db, { ADMIN_LOGIN: 'boss', ADMIN_PASSWORD: 'S3cret-pass' }, { log: () => {} });
  const server = createApp(db).listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const u = client(base), a = client(base), other = client(base);
  await u('POST', '/register', { login: 'pub1', password: 'password1', full_name: 'Pub Tadqiqotchi' });
  await other('POST', '/register', { login: 'pub2', password: 'password1', full_name: 'Boshqa Odam' });
  await u('PUT', '/profile', { status: 'doctoral', degree: 'phd', direction_code: '13.00.05', topic: 'Kasb-hunar ta’limi metodikasi', months: 12, start_month: '2027-01' });

  // validatsiya
  assert.equal((await u('POST', '/publications', { kind: 'x', title: 'Sarlavha' })).status, 400);
  assert.equal((await u('POST', '/publications', { kind: 'oak', title: 'a' })).status, 400);
  assert.equal((await u('POST', '/publications', { kind: 'oak', title: 'Yaxshi sarlavha', url: 'javascript:alert(1)' })).status, 400);
  assert.equal((await u('POST', '/publications', { kind: 'oak', title: 'Yaxshi sarlavha', submitted_at: '2027-13-45' })).status, 400);

  const oakJ = (await u('GET', '/catalog?type=oak&q=Pedagogik')).data.items[0];
  const r1 = await u('POST', '/publications', { kind: 'oak', title: 'Raqamli kompetensiyalar', journal_id: oakJ.id, status: 'submitted', submitted_at: '2020-01-01' });
  assert.equal(r1.status, 200);
  let list = (await u('GET', '/publications')).data;
  assert.equal(list.publications[0].journal_name, oakJ.name);              // katalogdan nom
  assert.equal(list.byKind.find((k) => k.kind === 'oak').published, 0);
  assert.equal(list.byKind.find((k) => k.kind === 'oak').inProgress, 1);
  assert.equal(list.totalNeeded, 7);
  assert.equal(list.slow.length, 1);                                       // 2020 yilda yuborilgan — juda uzoq
  const dash = (await u('GET', '/dashboard')).data;
  assert.ok(dash.alerts.some((x) => /hafta oldin yuborilgan/.test(x.text)));
  assert.equal(dash.pubs.total, 1);

  // chop etildi -> reja vazifasi avtomatik belgilanadi
  const before = (await u('GET', '/plan')).data.progress.tasksDone;
  assert.equal((await u('PUT', `/publications/${r1.data.id}`, { kind: 'oak', title: 'Raqamli kompetensiyalar', journal_id: oakJ.id, status: 'published', published_at: '2027-03-01', url: 'https://doi.org/10.1/x' })).status, 200);
  assert.equal((await u('GET', '/plan')).data.progress.tasksDone, before + 1);
  list = (await u('GET', '/publications')).data;
  assert.equal(list.byKind.find((k) => k.kind === 'oak').published, 1);
  assert.equal(list.publishedAll, 1);
  assert.equal(list.slow.length, 0);
  // qayta saqlash ikkinchi vazifani belgilamaydi
  await u('PUT', `/publications/${r1.data.id}`, { kind: 'oak', title: 'Raqamli kompetensiyalar', journal_id: oakJ.id, status: 'published' });
  assert.equal((await u('GET', '/plan')).data.progress.tasksDone, before + 1);
  // tur o'zgarsa eski belgi qaytariladi va yangisi belgilanadi (foreign)
  await u('PUT', `/publications/${r1.data.id}`, { kind: 'foreign', title: 'Raqamli kompetensiyalar', status: 'published', journal_name: 'Boshqa jurnal' });
  assert.equal((await u('GET', '/plan')).data.progress.tasksDone, before + 1);
  // holat qaytarilsa — belgi olinadi
  await u('PUT', `/publications/${r1.data.id}`, { kind: 'foreign', title: 'Raqamli kompetensiyalar', status: 'revision' });
  assert.equal((await u('GET', '/plan')).data.progress.tasksDone, before);

  // boshqa foydalanuvchi ko'ra/o'zgartira olmaydi
  assert.equal((await other('PUT', `/publications/${r1.data.id}`, { kind: 'oak', title: 'Hack hack' })).status, 404);
  assert.equal((await other('DELETE', `/publications/${r1.data.id}`)).status, 404);
  assert.equal((await other('GET', '/publications')).data.publications.length, 0);

  // o'chirish
  await u('PUT', `/publications/${r1.data.id}`, { kind: 'foreign', title: 'Raqamli kompetensiyalar', status: 'published' });
  assert.equal((await u('GET', '/plan')).data.progress.tasksDone, before + 1);
  assert.equal((await u('DELETE', `/publications/${r1.data.id}`)).status, 200);
  assert.equal((await u('GET', '/plan')).data.progress.tasksDone, before);
});

test('katalog qidiruvi va parol boshqaruvi', async (t) => {
  const db = open(':memory:'); await initSchema(db); await seedAll(db);
  await auth.ensureAdmin(db, { ADMIN_LOGIN: 'boss', ADMIN_PASSWORD: 'S3cret-pass' }, { log: () => {} });
  const server = createApp(db).listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const u = client(base), a = client(base);
  await u('POST', '/register', { login: 'cat1', password: 'password1', full_name: 'Katalog Odam' });

  const all = (await u('GET', '/catalog')).data;
  assert.ok(all.total > 250 && all.items.length === 30 && all.pages > 5);
  const q1 = (await u('GET', '/catalog?q=tourism&type=scopus&access=free&quartile=Q1')).data;
  assert.ok(q1.total >= 3 && q1.items.every((j) => j.scopus_status === 'active' && j.access === 'free' && j.quartile === 'Q1'));
  assert.ok(q1.items.every((j) => j.category === 'scopus'));
  assert.equal((await u('GET', '/catalog?page=2&size=10')).data.items.length, 10);

  // parol almashtirish
  assert.equal((await u('POST', '/account/password', { current: 'xato', password: 'newpassword1' })).status, 400);
  assert.equal((await u('POST', '/account/password', { current: 'password1', password: 'short' })).status, 400);
  assert.equal((await u('POST', '/account/password', { current: 'password1', password: 'newpassword1' })).status, 200);
  assert.equal((await u('GET', '/me')).data.user.login, 'cat1');           // joriy sessiya saqlanadi
  const u2 = client(base);
  assert.equal((await u2('POST', '/login', { login: 'cat1', password: 'password1' })).status, 401);
  assert.equal((await u2('POST', '/login', { login: 'cat1', password: 'newpassword1' })).status, 200);

  // admin parolni tiklaydi: eski sessiyalar tugaydi
  await a('POST', '/login', { login: 'boss', password: 'S3cret-pass' });
  const id = (await a('GET', '/admin/users')).data.users[0].id;
  assert.equal((await a('POST', `/admin/users/${id}/password`, { password: 'x' })).status, 400);
  assert.equal((await a('POST', `/admin/users/${id}/password`, { password: 'adminreset99' })).status, 200);
  assert.equal((await u2('GET', '/me')).data.user, null);
  assert.equal((await u2('POST', '/login', { login: 'cat1', password: 'adminreset99' })).status, 200);
  assert.equal((await u('POST', `/admin/users/${id}/password`, { password: 'hackhack123' })).status, 401); // sessiya tugagan
});

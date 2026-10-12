'use strict';
process.env.FEEDS_AUTO = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('../src/db-node');
const { initSchema } = require('../src/db');
const { seedAll } = require('../src/seed');
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
async function setup(t, email = 'th1') {
  delete process.env.GEMINI_API_KEY; delete process.env.OPENAI_API_KEY; delete process.env.ANTHROPIC_API_KEY; delete process.env.API_KEY;
  const db = open(':memory:'); await initSchema(db); await seedAll(db);
  const server = createApp(db).listen(0); t.after(() => server.close());
  const u = client(`http://127.0.0.1:${server.address().port}`);
  await u('POST', '/register', { login: email, password: 'password1', full_name: 'Tez Tadqiqotchi' });
  await u('PUT', '/profile', { status: 'doctoral', degree: 'phd', direction_code: '13.00.05', topic: 'Kasb-hunar kollejlarida raqamli kompetensiyalarni rivojlantirish', months: 6, start_month: '2027-01' });
  return { db, u };
}

test('dissertatsiya: boblar, OAK varaq chegarasi, kirish bandlari', async (t) => {
  const { u } = await setup(t);
  const d = (await u('GET', '/thesis')).data;
  assert.equal(d.chapters.length, 5);
  assert.equal(d.limit, 78);                                  // PhD 60 * 1.3 (pedagogika — ijtimoiy-gumanitar)
  assert.equal(d.target, 60);
  assert.equal(d.bands.length, 17);                           // xorijiy sharh faqat DSc uchun
  assert.ok(!d.bands.some((b) => b.key === 'xorijiy'));
  assert.equal(d.ideas, null); assert.equal(d.aiEnabled, false);

  // bob CRUD va validatsiya
  assert.equal((await u('POST', '/thesis/chapters', { title: 'X', pages_target: 5 })).status, 400);
  assert.equal((await u('POST', '/thesis/chapters', { title: 'Qo‘shimcha bob', pages_target: 999 })).status, 400);
  const added = (await u('POST', '/thesis/chapters', { title: 'IV bob. Qo‘shimcha', pages_target: 10, pages_done: 4, status: 'writing' })).data;
  const c = (await u('GET', '/thesis')).data.chapters.at(-1);
  assert.equal(c.id, added.id); assert.equal(c.pages_done, 4);
  assert.equal((await u('PUT', `/thesis/chapters/${c.id}`, { title: 'IV bob. Qo‘shimcha', pages_target: 10, pages_done: 10, status: 'done' })).status, 200);
  assert.equal((await u('GET', '/thesis')).data.written, 10);
  assert.equal((await u('DELETE', `/thesis/chapters/${c.id}`)).status, 200);

  // kirish bandlari: shablon qoralama (AI yo'q), saqlash, dashboard xulosasi
  const dr = (await u('POST', '/thesis/intro/maqsad/draft', {})).data;
  assert.equal(dr.ai, false); assert.match(dr.draft, /Tadqiqotning maqsadi/); assert.match(dr.draft, /Kasb-hunar kollejlarida/);
  assert.equal((await u('POST', '/thesis/intro/yoq_band/draft', {})).status, 404);
  assert.equal((await u('PUT', '/thesis/intro/maqsad', { text: 'Mening maqsadim', done: true })).status, 200);
  const d2 = (await u('GET', '/thesis')).data;
  assert.deepEqual([d2.bands.find((b) => b.key === 'maqsad').text, d2.bands.find((b) => b.key === 'maqsad').done], ['Mening maqsadim', true]);
  const dash = (await u('GET', '/dashboard')).data;
  assert.deepEqual([dash.thesis.introDone, dash.thesis.introTotal, dash.thesis.started], [1, 17, true]);
});

test('maqola g‘oyalari: shablon (7 ta, PhD), AI bilan, nashrga aylantirish', async (t) => {
  const { u, db } = await setup(t, 'th2');
  const r = (await u('POST', '/thesis/ideas', {})).data;
  assert.equal(r.ai, false); assert.equal(r.items.length, 7);
  const kinds = r.items.map((i) => i.kind);
  assert.equal(kinds.filter((k) => k === 'oak').length, 2); assert.equal(kinds.filter((k) => k === 'foreign').length, 1);
  assert.equal(kinds.filter((k) => k === 'conf_int').length, 2); assert.equal(kinds.filter((k) => k === 'conf_nat').length, 2);
  assert.ok(r.items.every((i) => i.title.length > 10 && i.outline));
  assert.equal((await u('GET', '/thesis')).data.ideas.items.length, 7);
  assert.equal((await u('POST', '/thesis/ideas/99/publication', {})).status, 404);
  assert.equal((await u('POST', '/thesis/ideas/2/publication', {})).status, 200);
  const pub = (await u('GET', '/publications')).data.publications[0];
  assert.deepEqual([pub.kind, pub.status, pub.title], [r.items[2].kind, 'draft', r.items[2].title]);

  // AI bilan: Gemini'ga soxta javob (test serveriga so'rovlar o'tkazib yuboriladi)
  process.env.GEMINI_API_KEY = 'AIzaFAKE';
  const realFetch = global.fetch; const prompts = [];
  global.fetch = async (url, init) => {
    if (!String(url).includes('generativelanguage')) return realFetch(url, init);
    const user = JSON.parse(init.body).contents[0].parts[0].text; prompts.push(user);
    const text = /JSON massiv/.test(JSON.parse(init.body).systemInstruction.parts[0].text)
      ? JSON.stringify([{ title: 'AI g‘oya 1: raqamli kompetensiyalar modeli', kind: 'ZZZ', chapter: 'I bob', outline: 'AI reja' }, { title: 'AI g‘oya 2: baholash mezonlari', kind: 'oak', chapter: 'II bob', outline: 'AI reja 2' }])
      : 'AI qoralama matni [raqam]';
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
  };
  try {
    const dr = (await u('POST', '/thesis/intro/dolzarb/draft', {})).data;
    assert.deepEqual([dr.ai, dr.draft], [true, 'AI qoralama matni [raqam]']);
    assert.match(prompts.at(-1), /Mavzuning dolzarbligi/);
    const ai = (await u('POST', '/thesis/ideas', {})).data;
    assert.equal(ai.ai, true); assert.equal(ai.items.length, 7);
    assert.match(ai.items[0].title, /^AI g‘oya 1/);
    assert.equal(ai.items[0].kind, 'oak');                 // tur reja bo'yicha qoladi (AI "ZZZ" desa ham)
    assert.doesNotMatch(ai.items[4].title, /^AI/);             // AI yetmagan joy shablon bilan to'ldiriladi
  } finally { global.fetch = realFetch; delete process.env.GEMINI_API_KEY; }
});

test('reja vs haqiqat grafigi va kalendar (.ics)', async (t) => {
  const { u } = await setup(t, 'th3');
  const plan = (await u('GET', '/plan')).data;
  const first = plan.months[0].tasks[0];
  await u('POST', '/plan/task', { key: first.key, done: true });
  const tl = (await u('GET', '/progress/timeline')).data;
  assert.equal(tl.points.length, 6);
  assert.equal(tl.points.at(-1).planned, 100);
  assert.ok(tl.points.every((p, i, a) => i === 0 || p.planned >= a[i - 1].planned));
  assert.ok(tl.points.some((p) => p.actual != null));

  const res = await u('GET', '/plan.ics', null, true);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/calendar/);
  assert.match(res.headers.get('content-disposition'), /attachment/);
  const ics = await res.text();
  assert.ok(ics.startsWith('BEGIN:VCALENDAR') && ics.trimEnd().endsWith('END:VCALENDAR'));
  const events = ics.match(/BEGIN:VEVENT/g).length;
  const open = plan.months.flatMap((m) => m.tasks).filter((x) => x.key !== first.key).length;
  assert.equal(events, open);                                  // bajarilgan vazifa kalendarga kirmaydi
  assert.match(ics, /DTSTART;VALUE=DATE:20270131/);            // 1-oy oxiri
  assert.ok(ics.split('\r\n').every((l) => l.length <= 75));   // iCalendar qator uzunligi
  assert.equal((await u('GET', '/me')).data.user.login, 'th3');
});

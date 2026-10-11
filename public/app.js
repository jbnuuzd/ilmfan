'use strict';
/* Ilmiy yuksalish — frontend (vanilla JS, hash routing). Barcha matnlar textContent orqali qo'yiladi (XSS-xavfsiz). */

const $app = document.getElementById('app');
const state = { user: null, meta: null };

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

// replaceChildren massiv/null qabul qilmaydi — h() kabi tekislab joylaydi
function fill(el, ...kids) {
  el.replaceChildren();
  for (const kid of kids.flat(Infinity)) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
}

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'content-type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && state.user) { state.user = null; render(); }
    throw new Error(data.error || 'Xatolik');
  }
  return data;
}

function toast(msg) { const t = h('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), 4500); }
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);
const link = (u, text) => (safeUrl(u) ? h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, text) : null);

const STATUS = { doctoral: 'Doktorant', independent: 'Mustaqil izlanuvchi', beginner: 'Tadqiqotni endi boshlamoqchiman' };
const CATS = { scopus: 'Scopus', oak: 'OAK jurnallari', impact: 'Yuqori impakt faktor', conference: 'Konferensiyalar' };

// ---------------- Auth ----------------
function authView() {
  let mode = 'login';
  const box = h('div', { class: 'card auth' });
  const draw = () => {
    const err = h('div', { class: 'err' });
    const f = {};
    const field = (id, label, type = 'text', ac) => { f[id] = h('input', { type, id, autocomplete: ac }); return [h('label', { for: id }, label), f[id]]; };
    fill(box, 
      h('h1', {}, 'Ilmiy yuksalish'),
      h('p', { class: 'muted' }, "Tadqiqotchilar uchun: jurnallar, OAK talablari, shaxsiy trayektoriya va sun'iy intellekt ko'magi."),
      h('div', { class: 'tabs seg' },
        h('button', { class: mode === 'login' ? 'on' : '', onclick: () => { mode = 'login'; draw(); } }, 'Kirish'),
        h('button', { class: mode === 'register' ? 'on' : '', onclick: () => { mode = 'register'; draw(); } }, "Ro'yxatdan o'tish")),
      mode === 'register' ? field('full_name', 'Ism-familiya (otasining ismi bilan)', 'text', 'name') : null,
      field('login', 'Login', 'text', 'username'),
      field('password', 'Parol' + (mode === 'register' ? ' (kamida 8 belgi)' : ''), 'password', mode === 'login' ? 'current-password' : 'new-password'),
      err,
      h('button', { class: 'primary', onclick: async (e) => {
        e.target.disabled = true; err.textContent = '';
        try {
          await api(mode === 'login' ? '/login' : '/register', { method: 'POST', body: { login: f.login.value, password: f.password.value, full_name: f.full_name?.value } });
          await boot();
        } catch (x) { err.textContent = x.message; e.target.disabled = false; }
      } }, mode === 'login' ? 'Kirish' : "Ro'yxatdan o'tish"));
    box.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') box.querySelector('button.primary').click(); }));
  };
  draw();
  return h('main', {}, box, h('p', { class: 'muted small', style: 'text-align:center' }, state.meta?.notice || ''));
}

// ---------------- Layout ----------------
const USER_NAV = [['#/', 'Bosh sahifa'], ['#/profile', 'Profil'], ['#/plan', 'Trayektoriya'], ['#/documents', 'Hujjatlar'], ['#/oak', 'OAK ma’lumotnomasi'], ['#/j/scopus', 'Scopus'], ['#/j/oak', 'OAK'], ['#/j/impact', 'Impakt faktor'], ['#/j/conference', 'Konferensiyalar']];
const ADMIN_NAV = [['#/admin', 'Statistika'], ['#/admin/users', 'Foydalanuvchilar'], ['#/admin/journals', 'Jurnallar'], ['#/admin/import', 'Fid / import'], ['#/admin/directions', "Yo'nalishlar"], ['#/admin/requirements', 'OAK talablari'], ['#/admin/doc_templates', 'Hujjat shablonlari'], ['#/admin/quotes', 'Iqtiboslar'], ['#/admin/changes', "O'zgarishlar"]];

function layout(content) {
  const nav = state.user.role === 'admin' ? ADMIN_NAV : USER_NAV;
  const cur = location.hash || '#/';
  return h('div', {},
    h('header', { class: 'top' }, h('div', { class: 'bar' },
      h('a', { class: 'logo', href: state.user.role === 'admin' ? '#/admin' : '#/' }, '🎓 Ilmiy yuksalish'),
      h('nav', {}, nav.map(([href, label]) => h('a', { href, class: cur === href || (href.length > 3 && cur.startsWith(href + '/')) ? 'active' : '' }, label))),
      h('span', { class: 'muted small' }, state.user.full_name),
      h('button', { onclick: async () => { await api('/logout', { method: 'POST', body: {} }); state.user = null; location.hash = '#/'; render(); } }, 'Chiqish'))),
    h('main', {}, content));
}

// ---------------- Dashboard ----------------
async function dashboardView() {
  const d = await api('/dashboard');
  const quote = d.quote ? h('div', { class: 'card hero' }, h('p', { class: 'q' }, `«${d.quote.text}»`), h('div', { class: 'by' }, `— ${d.quote.author}`, d.quote.note ? h('span', { class: 'small' }, `  (${d.quote.note})`) : null)) : null;
  if (d.needProfile) return h('div', {}, quote, h('div', { class: 'card' }, h('h2', {}, `Xush kelibsiz, ${d.name}!`), h('p', {}, "Shaxsiy trayektoriyangiz tuzilishi uchun avval tadqiqot yo'nalishingiz, mavzu va muddatni kiriting."), h('a', { class: 'btn primary', href: '#/profile' }, "Profilni to'ldirish")));
  const pct = d.progress.pct;
  return h('div', {}, quote,
    h('div', { class: 'card motiv' }, h('div', { class: 'small muted' }, d.aiEnabled ? "Sun'iy intellekt xabari" : 'Kundalik xabar'), h('p', { style: 'margin:6px 0 0' }, d.motivation)),
    d.alerts.map((a) => h('div', { class: `alert ${a.level}` }, a.text)),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h3', {}, 'Umumiy bajarilish'), h('div', { class: 'big' }, `${pct}%`), h('div', { class: 'progress', style: 'margin:10px 0' }, h('i', { style: `width:${pct}%` })),
        h('div', { class: 'muted small' }, `${d.progress.tasksDone}/${d.progress.tasksTotal} vazifa · rejadagi muddatgacha ${d.daysLeft > 0 ? d.daysLeft + ' kun' : 'muddat tugagan'}`),
        h('p', { class: 'small' }, `${d.direction.code} — ${d.direction.name}`), h('p', { class: 'small muted' }, `Mavzu: ${d.profile.topic}`)),
      h('div', { class: 'card' }, h('h3', {}, `Shu oy vazifalari (${d.currentMonth})`), d.thisMonth.length ? d.thisMonth.map((t) => taskRow(t)) : h('p', { class: 'muted' }, "Bu oyga vazifa rejalashtirilmagan."), h('a', { href: '#/plan' }, "To'liq trayektoriya →"))),
    h('div', { class: 'card' }, h('h3', {}, 'Dissertatsiya himoyasi uchun minimal talablar'), reqTable(d.requirements)));
}

function taskRow(t, onChange) {
  const cb = h('input', { type: 'checkbox', checked: t.done, onchange: async () => {
    try { await api('/plan/task', { method: 'POST', body: { key: t.key, done: cb.checked } }); row.classList.toggle('done', cb.checked); onChange?.(); } catch (e) { toast(e.message); cb.checked = !cb.checked; }
  } });
  const row = h('label', { class: `task ${t.done ? 'done' : ''}`, style: 'font-weight:400;margin:0' }, cb, h('span', { class: 't' }, t.title, t.optional ? h('span', { class: 'pill' }, 'ixtiyoriy') : null));
  return row;
}

function reqTable(rows) {
  return h('div', { class: 'tablewrap' }, h('table', {}, h('tr', {}, ['Talab', 'Minimal', 'Rejada', 'Bajarilgan', ''].map((x) => h('th', {}, x))),
    rows.map((r) => h('tr', {}, h('td', {}, r.title, h('div', { class: 'small muted' }, r.description)), h('td', {}, r.min_count), h('td', {}, r.planned), h('td', {}, `${r.done}/${r.min_count}`),
      h('td', {}, r.verified ? h('span', { class: 'pill green' }, 'tasdiqlangan') : h('span', { class: 'pill warn', title: 'Rasmiy OAK hujjati bilan solishtiring' }, 'tekshirilmagan'))))));
}

// ---------------- Profile ----------------
async function profileView() {
  const { profile } = await api('/profile');
  const p = profile || { status: 'beginner', degree: 'phd', direction_code: '', topic: '', months: 12, start_month: new Date().toISOString().slice(0, 7) };
  const groups = {};
  state.meta.directions.forEach((d) => (groups[d.field_group] ||= []).push(d));
  const f = {
    status: h('select', {}, Object.entries(STATUS).map(([k, v]) => h('option', { value: k, selected: p.status === k }, v))),
    degree: h('select', {}, [['phd', 'Falsafa doktori (PhD)'], ['dsc', 'Fan doktori (DSc)']].map(([k, v]) => h('option', { value: k, selected: p.degree === k }, v))),
    dir: h('select', {}, h('option', { value: '' }, '— tanlang —'), Object.entries(groups).map(([g, ds]) => h('optgroup', { label: g }, ds.map((d) => h('option', { value: d.code, selected: p.direction_code === d.code }, `${d.code} — ${d.name}`))))),
    topic: h('textarea', { placeholder: 'Masalan: Kollej o‘quvchilarida raqamli kompetensiyalarni rivojlantirish metodikasi' }, p.topic),
    months: h('input', { type: 'number', min: 1, max: 60, value: p.months }),
    start: h('input', { type: 'month', value: p.start_month }),
  };
  const err = h('div', { class: 'err' });
  return h('div', { class: 'card', style: 'max-width:760px' }, h('h1', {}, 'Tadqiqotchi profili'),
    h('p', { class: 'muted' }, "Bu ma'lumotlar asosida OAK talablari, oyma-oy trayektoriya va jurnal tavsiyalari shakllantiriladi."),
    h('label', {}, 'Siz kimsiz?'), f.status, h('label', {}, 'Ilmiy daraja'), f.degree,
    h('label', {}, "Tadqiqot yo'nalishi (ixtisoslik)"), f.dir, h('label', {}, 'Ilmiy ish mavzusi'), f.topic,
    h('div', { class: 'row2' }, h('div', {}, h('label', {}, 'Tadqiqotni necha oyda yakunlamoqchisiz?'), f.months), h('div', {}, h('label', {}, 'Boshlanish oyi'), f.start)),
    err, h('div', { style: 'margin-top:14px' }, h('button', { class: 'primary', onclick: async (e) => {
      e.target.disabled = true; err.textContent = '';
      try { await api('/profile', { method: 'PUT', body: { status: f.status.value, degree: f.degree.value, direction_code: f.dir.value, topic: f.topic.value, months: f.months.value, start_month: f.start.value } }); toast('Saqlandi'); location.hash = '#/plan'; }
      catch (x) { err.textContent = x.message; e.target.disabled = false; }
    } }, 'Saqlash va trayektoriyani yaratish')));
}

// ---------------- Plan ----------------
async function planView() {
  const d = await api('/plan');
  if (d.needProfile) return needProfile();
  const bar = h('div', { class: 'progress' }, h('i', { style: `width:${d.progress.pct}%` }));
  const pctEl = h('span', { class: 'big' }, `${d.progress.pct}%`);
  const refreshProgress = async () => { const x = await api('/plan'); pctEl.textContent = `${x.progress.pct}%`; bar.firstChild.style.width = `${x.progress.pct}%`; };
  return h('div', {}, h('h1', {}, `Shaxsiy trayektoriya — ${d.profile.months} oy`),
    h('div', { class: 'card' }, pctEl, h('span', { class: 'muted' }, ' bajarilgan'), h('div', { style: 'margin-top:10px' }, bar)),
    d.warnings.map((w) => h('div', { class: 'alert amber' }, w)),
    d.advice ? h('div', { class: 'card motiv' }, h('div', { class: 'small muted' }, "Sun'iy intellekt maslahati"), h('div', { style: 'white-space:pre-wrap' }, d.advice)) : null,
    h('div', { class: 'card' }, h('h3', {}, 'OAK minimal talablari'), reqTable(d.requirements)),
    h('h2', {}, 'Oyma-oy reja-grafik'),
    d.months.map((m) => h('div', { class: `month ${m.current ? 'current' : ''}` }, h('h3', {}, `${m.index}-oy · ${m.label}`, m.current ? h('span', { class: 'pill' }, 'hozirgi oy') : null),
      m.tasks.length ? m.tasks.map((t) => taskRow(t, refreshProgress)) : h('div', { class: 'muted small' }, "Bu oy asosiy ishlarni davom ettirish va yozish uchun zaxira."))));
}

function needProfile() { return h('div', { class: 'card' }, h('p', {}, "Avval profilni to'ldiring."), h('a', { class: 'btn primary', href: '#/profile' }, 'Profilga o‘tish')); }

// ---------------- Documents ----------------
async function documentsView() {
  const d = await api('/documents');
  if (d.needProfile) return needProfile();
  const cats = { experiment: 'Tajriba-sinov ishlari', implementation: 'Joriy etish va amaliyot', defense: 'Himoya hujjatlari', admin: 'Rasmiy / ma’muriy' };
  return h('div', {}, h('h1', {}, 'Himoya uchun kerakli hujjatlar'),
    d.newRegime ? h('div', { class: 'alert amber' }, "Rejangiz 2027-yil 1-yanvardan keyin tugaydi — PF-98 bo'yicha bekor qilinadigan talablar «bekor» deb belgilangan. Yangi nizomlar tasdiqlanguncha ularni ham rasmiy manbada tekshiring.") : h('div', { class: 'alert blue' }, 'Himoyangiz 2027-yil 1-yanvargacha rejalashtirilgan: ESKI tartib amal qiladi (OAK e’loni, yetakchi tashkilot, joriy etish xulosasi, avtoreferat va h.k.).'),
    h('p', { class: 'muted' }, "Bu ro'yxat yo'nalishingizga moslashtirilgan. Hech qaysi hujjat oxirgi daqiqada esdan chiqmasligi uchun har birini bajarilgach belgilang."),
    d.hints.length ? h('div', { class: 'card' }, h('h3', {}, `${d.direction.code} yo'nalishi bo'yicha tavsiya etiladigan ma'lumotnomalar va joriy etish hujjatlari`), h('ul', {}, d.hints.map((x) => h('li', {}, x))), h('div', { class: 'small muted' }, "Tavsiyalar umumiy amaliyotga asoslangan. Aniq talablarni dissertatsiya kengashi va ilmiy rahbaringiz bilan tasdiqlang.")) : null,
    Object.entries(cats).map(([k, title]) => {
      const items = d.docs.filter((x) => x.category === k);
      return items.length ? h('div', { class: 'card' }, h('h3', {}, title), items.map((x) => {
        const row = taskRow({ key: x.taskKey, done: x.done, title: x.title, optional: !x.required });
        return h('div', {}, row, h('div', { class: 'small muted', style: 'margin:-4px 0 8px 28px' }, x.cancelled ? h('span', { class: 'pill warn' }, `${x.cancelled_from} dan bekor`) : null, x.description, x.plannedMonth ? ` · Rejada: ${x.plannedMonth}` : ''));
      })) : null;
    }),
    h('h2', {}, 'Nashr talablari'), h('div', { class: 'card' }, reqTable(d.requirements)));
}

// ---------------- OAK ma'lumotnomasi ----------------
async function oakView() {
  const k = await api('/knowledge');
  return h('div', {}, h('h1', {}, 'OAK ma’lumotnomasi'),
    h('div', { class: 'alert amber' }, k.warning), h('p', { class: 'small muted' }, `Ma’lumotlar holati: ${k.asOf}. Manba: oak.uz va lex.uz.`),
    k.sections.map((sec) => h('div', { class: 'card' }, h('h3', {}, sec.title), h('ul', {}, sec.items.map((x) => h('li', {}, x))), sec.source ? h('div', { class: 'small' }, link(sec.source, 'Rasmiy manba ↗')) : null)),
    h('div', { class: 'card' }, h('h3', {}, 'Foydali havolalar'), h('ul', {}, k.links.map(([t, u]) => h('li', {}, link(u, t))))));
}

// ---------------- Journals ----------------
async function journalsView(category) {
  let access = sessionStorage.getItem('access') || 'free';
  const wrap = h('div', {});
  const draw = async () => {
    fill(wrap, h('p', { class: 'muted' }, 'Yuklanmoqda…'));
    try {
      const d = await api(`/journals?category=${category}&access=${access}`);
      if (d.needProfile) return fill(wrap, needProfile());
      const refreshBtn = h('button', { class: 'primary', onclick: async () => {
        refreshBtn.disabled = true; refreshBtn.textContent = 'Tekshirilmoqda…';
        try { const r = await api('/journals/refresh', { method: 'POST', body: { category, access } }); toast(r.summary); } catch (e) { toast(e.message); }
        draw();
      } }, '🔄 Yangilash (Refresh)');
      const flagged = d.items.filter((i) => i.flag);
      fill(wrap, 
        h('div', { class: 'tabs seg' }, [['free', 'Bepul'], ['paid', 'Pullik']].map(([k, v]) => h('button', { class: access === k ? 'on' : '', onclick: () => { access = k; sessionStorage.setItem('access', k); draw(); } }, v))),
        h('div', { class: 'card' }, h('div', { class: 'jhead' }, h('div', {}, h('b', {}, `${d.items.filter((i) => !i.flag).length} ta faol tavsiya`), flagged.length ? h('span', { class: 'pill red' }, `${flagged.length} ta o'zgargan`) : null,
          h('div', { class: 'small muted' }, d.lastRefresh ? `Oxirgi tekshiruv: ${d.lastRefresh.created_at} UTC — ${d.lastRefresh.summary.split('\n')[0]}` : 'Hali yangilanmagan'), d.lastRefresh?.summary.includes('\n') ? h('div', { class: 'small', style: 'white-space:pre-wrap' }, d.lastRefresh.summary.split('\n').slice(1).join('\n')) : null), refreshBtn),
          h('div', { class: 'small muted', style: 'margin-top:8px' }, "Refresh: Scopus kvartili, OAK ro'yxati holati qayta tekshiriladi. O'zgargan jurnallar o'chirilmaydi — qizil bilan belgilanadi va ularning o'rniga yangilari tavsiya etiladi.")),
        d.items.length ? d.items.map((j) => jcard(j, category, d.ai)) : h('div', { class: 'card muted' }, "Bu bo'limda yo'nalishingizga mos jurnal topilmadi. Administrator ma'lumotlar bazasini to'ldirgach paydo bo'ladi."));
    } catch (e) { fill(wrap, h('div', { class: 'alert red' }, e.message)); }
  };
  await draw();
  return h('div', {}, h('h1', {}, CATS[category]), wrap, h('p', { class: 'small muted' }, state.meta.notice));
}

function jcard(j, category, aiOn) {
  const cls = j.flag ? 'flagged' : j.note === 'new' ? 'new' : j.note === 'upgraded' ? 'up' : '';
  const searchUrl = `https://www.scimagojr.com/journalsearch.php?q=${encodeURIComponent(j.name)}`;
  return h('div', { class: `jcard ${cls}` },
    h('div', { class: 'jhead' }, h('div', {}, h('h3', {}, j.name),
      h('div', {}, j.quartile ? h('span', { class: `pill ${j.quartile.toLowerCase()}` }, j.quartile) : null,
        j.scopus_status === 'active' ? h('span', { class: 'pill' }, 'Scopus') : j.scopus_status === 'discontinued' ? h('span', { class: 'pill red' }, 'Scopus: chiqqan') : null,
        j.oak_status === 'active' ? h('span', { class: 'pill green' }, 'OAK') : j.oak_status === 'removed' ? h('span', { class: 'pill red' }, 'OAK: chiqarilgan') : null,
        j.impact_factor ? h('span', { class: 'pill' }, `IF ≈ ${j.impact_factor}`) : null,
        j.note === 'new' ? h('span', { class: 'pill green' }, 'Yangi tavsiya') : null, j.note === 'upgraded' ? h('span', { class: 'pill green' }, '↑ Kvartil ko‘tarilgan') : null,
        j.verified ? null : h('span', { class: 'pill warn', title: "Ma'lumot rasmiy manba bilan tasdiqlanmagan" }, 'tekshirilmagan'))),
      j.fit_score != null ? h('div', { style: 'text-align:right' }, h('div', { class: 'small muted' }, 'Sizga moslik'), h('span', { class: 'meter' }, h('i', { style: `width:${j.fit_score}%` })), ` ${j.fit_score}%`) : null),
    j.flag ? h('div', { class: 'alert red', style: 'margin:0' }, `⚠ ${j.flag_reason}. Jurnal ro'yxatdan o'chirilmadi — avval shu jurnalda ishlagan bo'lsangiz ma'lumot saqlanadi.`) : null,
    h('div', { class: 'small muted' }, [j.publisher, j.country, j.since_year ? `${j.since_year}-yildan beri` : null, j.issn ? `ISSN ${j.issn}` : null, j.access === 'paid' ? (j.apc_usd ? `Nashr to‘lovi ≈ $${j.apc_usd}` : 'Pullik') : 'Mualliflardan to‘lov talab qilinmaydi', j.review_weeks ? `ko‘rib chiqish ≈ ${j.review_weeks} hafta` : null].filter(Boolean).join(' · ')),
    j.description ? h('div', { class: 'small' }, j.description) : null,
    j.fit_text ? h('div', { class: 'fit' }, h('b', {}, aiOn ? "🤖 AI tahlili: " : 'Moslik tahlili: '), j.fit_text) : null,
    h('div', { class: 'links' }, link(j.official_url, 'Rasmiy veb-sahifa ↗'), category !== 'conference' && j.scopus_status !== 'none' ? link(j.scopus_url || searchUrl, 'Scopus indekslanganligini tekshirish ↗') : null,
      j.oak_status !== 'none' ? link(j.oak_url || 'https://oak.uz', 'OAK ro‘yxati (oak.uz) ↗') : null,
      !j.official_url ? link(`https://www.google.com/search?q=${encodeURIComponent(j.name + ' official site')}`, 'Rasmiy saytni qidirish ↗') : null));
}

// ---------------- Admin ----------------
async function adminHome() {
  const s = await api('/admin/stats');
  const stat = (t, v) => h('div', { class: 'card' }, h('div', { class: 'muted small' }, t), h('div', { class: 'big' }, v));
  const cols = ['scopus_free', 'scopus_paid', 'oak_free', 'oak_paid', 'impact_free', 'impact_paid', 'conference_free', 'conference_paid'];
  return h('div', {}, h('h1', {}, 'Administrator paneli'),
    h('div', { class: 'grid g3' }, stat('Tadqiqotchilar', s.users), stat('Jurnallar bazasi', s.journals), stat('Tekshirilmagan yozuvlar', s.unverified), stat('Scopus faol', s.scopus), stat('OAK faol', s.oak)),
    h('div', { class: 'card' }, h('b', {}, 'Integratsiya holati: '), `AI: ${s.ai ? 'yoqilgan' : 'o‘chiq (ANTHROPIC_API_KEY yo‘q)'} · Scopus fid: ${s.feeds.scopus ? 'ulangan' : 'yo‘q'} · OAK fid: ${s.feeds.oak ? 'ulangan' : 'yo‘q'}`,
      h('div', { style: 'margin-top:10px' }, h('button', { onclick: async (e) => { e.target.disabled = true; try { toast((await api('/admin/sync', { method: 'POST', body: {} })).message); } catch (x) { toast(x.message); } e.target.disabled = false; } }, '🔄 Fidlarni hozir sinxronlash'))),
    h('div', { class: 'card' }, h('h3', {}, "Yo'nalishlar bo'yicha qamrov (har bir katakda kamida 10 ta bo'lishi kerak)"), h('div', { class: 'tablewrap' }, h('table', {}, h('tr', {}, [h('th', {}, "Yo'nalish"), ...cols.map((c) => h('th', {}, c.replace('_', ' ')))]),
      s.coverage.map((r) => h('tr', {}, h('td', {}, `${r.code} ${r.name}`), cols.map((c) => h('td', {}, h('span', { class: `pill ${r[c] >= 10 ? 'green' : 'red'}` }, r[c])))))))));
}

async function adminUsers() {
  const { users } = await api('/admin/users');
  return h('div', {}, h('h1', {}, 'Foydalanuvchilar'), h('div', { class: 'card tablewrap' }, h('table', {}, h('tr', {}, ['Ism', 'Login', "Yo'nalish", 'Mavzu', 'Muddat', 'Bajarilish', 'Ro‘yxatdan o‘tgan', ''].map((x) => h('th', {}, x))),
    users.map((u) => h('tr', {}, h('td', {}, u.full_name), h('td', {}, u.login), h('td', {}, u.direction_code || '—'), h('td', {}, u.topic || '—'), h('td', {}, u.months ? `${u.months} oy` : '—'), h('td', {}, u.progress != null ? `${u.progress}%` : '—'), h('td', {}, u.created_at),
      h('td', {}, h('button', { class: 'danger', onclick: async () => { if (confirm(`${u.full_name} o‘chirilsinmi?`)) { await api(`/admin/users/${u.id}`, { method: 'DELETE', body: {} }); render(); } } }, 'O‘chirish')))))));
}

const LABELS = { name: 'Nomi', kind: 'Turi (journal/conference)', issn: 'ISSN', publisher: 'Nashriyot', country: 'Mamlakat', since_year: 'Boshlangan yil', access: 'Kirish (free/paid)', apc_usd: 'Nashr to‘lovi, USD', scopus_status: 'Scopus (none/active/discontinued)', quartile: 'Kvartil (Q1–Q4)', oak_status: 'OAK (none/active/removed)', impact_factor: 'Impakt faktor', wos: 'WoS (0/1)', subjects: 'Teglar (vergul bilan)', acceptance: 'Qabul ehtimoli 1–5', review_weeks: 'Ko‘rib chiqish, hafta', official_url: 'Rasmiy sayt URL', scopus_url: 'Scopus isbot havolasi', oak_url: 'OAK havolasi', description: 'Tavsif', verified: 'Tasdiqlangan (0/1)', code: 'Kod', field_group: 'Soha guruhi', tags: 'Teglar', hints: "Maslahatlar ('|' bilan ajrating)", degree: 'Daraja (phd/dsc)', title: 'Sarlavha', min_count: 'Minimal soni', source_url: 'Manba URL', key: 'Kalit', category: 'Kategoriya', cancelled_from: 'Bekor qilinish sanasi (YYYY-MM-DD)', phase: 'Bosqich (early/mid/late)', required: 'Majburiy (0/1)', directions: "Yo'nalish teglari (bo'sh=hammaga)", author: 'Muallif', text: 'Matn', note: 'Izoh' };
const LONG = new Set(['description', 'hints', 'text']);
const SHOW = { journals: ['name', 'kind', 'access', 'scopus_status', 'quartile', 'oak_status', 'verified'], directions: ['code', 'name', 'tags'], requirements: ['degree', 'kind', 'title', 'min_count', 'verified'], doc_templates: ['key', 'category', 'title', 'phase'], quotes: ['author', 'text'] };
const ENTITY_TITLES = { journals: 'Jurnallar va konferensiyalar', directions: "Tadqiqot yo'nalishlari", requirements: 'OAK minimal talablari', doc_templates: 'Hujjat shablonlari', quotes: 'Iqtiboslar' };

async function adminEntity(name) {
  const d = await api(`/admin/e/${name}`);
  let filter = '';
  const tbody = h('tbody');
  const draw = () => {
    tbody.replaceChildren(...d.rows.filter((r) => !filter || JSON.stringify(r).toLowerCase().includes(filter)).map((r) => h('tr', {}, SHOW[name].map((c) => h('td', {}, String(r[c] ?? '').slice(0, 90))),
      h('td', {}, h('button', { onclick: () => edit(r) }, 'Tahrirlash')))));
  };
  const edit = (row) => {
    const isNew = !row; const inputs = {};
    const form = d.cols.map((c) => {
      const el = LONG.has(c) ? h('textarea', {}, row?.[c] ?? '') : h('input', { value: row?.[c] ?? '' });
      if (!isNew && c === d.pk) el.setAttribute('disabled', '');
      inputs[c] = el; return h('div', {}, h('label', {}, LABELS[c] || c), el);
    });
    const err = h('div', { class: 'err' });
    const modal = h('div', { class: 'modal' }, h('div', { class: 'card' }, h('h2', { style: 'margin-top:0' }, isNew ? 'Yangi yozuv' : 'Tahrirlash'), h('div', { class: 'row2' }, form), err,
      h('div', { style: 'display:flex;gap:8px;margin-top:14px' },
        h('button', { class: 'primary', onclick: async () => {
          const body = {}; d.cols.forEach((c) => { body[c] = inputs[c].value; });
          try { await api(isNew ? `/admin/e/${name}` : `/admin/e/${name}/${encodeURIComponent(row[d.pk])}`, { method: isNew ? 'POST' : 'PUT', body }); modal.remove(); render(); } catch (x) { err.textContent = x.message; }
        } }, 'Saqlash'), h('button', { onclick: () => modal.remove() }, 'Bekor qilish'),
        isNew ? null : h('button', { class: 'danger', style: 'margin-left:auto', onclick: async () => { if (confirm("O'chirilsinmi?")) { await api(`/admin/e/${name}/${encodeURIComponent(row[d.pk])}`, { method: 'DELETE', body: {} }); modal.remove(); render(); } } }, "O'chirish"))));
    document.body.append(modal);
  };
  draw();
  return h('div', {}, h('h1', {}, ENTITY_TITLES[name]),
    h('div', { style: 'display:flex;gap:10px;margin-bottom:12px' }, h('input', { placeholder: 'Qidirish…', oninput: (e) => { filter = e.target.value.toLowerCase(); draw(); } }), h('button', { class: 'primary', onclick: () => edit(null) }, '+ Qo‘shish')),
    name === 'requirements' ? h('div', { class: 'alert amber' }, "Bu yerdagi minimal talablar namuna sifatida kiritilgan. Rasmiy OAK nizomi (oak.uz / lex.uz) bilan solishtirib tahrirlang va «Tasdiqlangan» ni 1 qiling — foydalanuvchilarda «tekshirilmagan» belgisi shundan keyin yo‘qoladi.") : null,
    h('div', { class: 'card tablewrap' }, h('table', {}, h('thead', {}, h('tr', {}, [...SHOW[name].map((c) => h('th', {}, LABELS[c] || c)), h('th')])), tbody)));
}

async function adminImport() {
  const f = { source: h('select', {}, h('option', { value: 'scopus' }, 'Scopus / SCImago (kvartillar)'), h('option', { value: 'oak' }, 'OAK ro‘yxati (oak.uz)')), content: h('textarea', { style: 'min-height:220px', placeholder: 'CSV (SCImago: "Title;Issn;SJR Best Quartile;…") yoki JSON massiv shu yerga qo‘yiladi' }), full: h('input', { type: 'checkbox', style: 'width:auto' }), addNew: h('input', { type: 'checkbox', style: 'width:auto' }) };
  const out = h('div', { class: 'small', style: 'margin-top:10px;white-space:pre-wrap' });
  const file = h('input', { type: 'file', accept: '.csv,.json,.txt', onchange: async (e) => { f.content.value = await e.target.files[0].text(); } });
  const run = (path, label) => h('button', { class: label === 'AI' ? '' : 'primary', onclick: async (e) => {
    e.target.disabled = true; out.textContent = 'Bajarilmoqda…';
    try { const r = await api(path, { method: 'POST', body: { source: f.source.value, content: f.content.value, full: f.full.checked, addNew: f.addNew.checked } }); out.textContent = `${r.total} ta yozuv o‘qildi — ${r.text}`; } catch (x) { out.textContent = x.message; }
    e.target.disabled = false;
  } }, label === 'AI' ? "🤖 AI bilan ajratib import qilish" : 'Import qilish');
  return h('div', {}, h('h1', {}, 'Fid / import'),
    h('div', { class: 'card' }, h('p', {}, "Scopus kvartillari (SCImago CSV) va OAK ro'yxatini shu yerdan yuklang yoki serverda SCOPUS_FEED_URL / OAK_FEED_URL sozlang — Refresh bosilganda foydalanuvchilarga o'zgarishlar avtomatik ko'rsatiladi (qizil belgi + yangi tavsiya)."),
      h('label', {}, 'Manba'), f.source, h('label', {}, 'Fayl'), file, h('label', {}, 'yoki matn'), f.content,
      h('label', { style: 'font-weight:400' }, f.full, ' To‘liq ro‘yxat: manbada yo‘q faol jurnallar «chiqib ketgan» deb belgilansin'),
      h('label', { style: 'font-weight:400' }, f.addNew, ' Bazada yo‘q jurnallar yangi sifatida qo‘shilsin'),
      h('div', { style: 'display:flex;gap:8px;margin-top:12px' }, run('/admin/import', 'Import'), run('/admin/ai-import', 'AI')), out));
}

async function adminChanges() {
  const { changes } = await api('/admin/changes');
  return h('div', {}, h('h1', {}, "Jurnallardagi o'zgarishlar tarixi"), h('div', { class: 'card tablewrap' }, h('table', {}, h('tr', {}, ['Sana (UTC)', 'Jurnal', 'Maydon', 'Eski', 'Yangi', 'Manba'].map((x) => h('th', {}, x))),
    changes.map((c) => h('tr', {}, h('td', {}, c.changed_at), h('td', {}, c.name), h('td', {}, c.field), h('td', {}, c.old_value), h('td', {}, c.new_value), h('td', {}, c.source))))));
}

// ---------------- Router ----------------
async function render() {
  if (!state.user) return fill($app, authView());
  const hash = location.hash || '#/';
  let view;
  try {
    const isAdmin = state.user.role === 'admin';
    if (isAdmin) {
      if (hash.startsWith('#/admin/users')) view = await adminUsers();
      else if (hash.startsWith('#/admin/import')) view = await adminImport();
      else if (hash.startsWith('#/admin/changes')) view = await adminChanges();
      else if (/^#\/admin\/(journals|directions|requirements|doc_templates|quotes)$/.test(hash)) view = await adminEntity(hash.split('/')[2]);
      else view = await adminHome();
    } else if (hash === '#/profile') view = await profileView();
    else if (hash === '#/plan') view = await planView();
    else if (hash === '#/documents') view = await documentsView();
    else if (hash === '#/oak') view = await oakView();
    else if (/^#\/j\/(scopus|oak|impact|conference)$/.test(hash)) view = await journalsView(hash.split('/')[2]);
    else view = await dashboardView();
  } catch (e) { view = h('div', { class: 'alert red' }, e.message); }
  fill($app, layout(view));
  window.scrollTo(0, 0);
}

async function boot() {
  const [me, meta] = await Promise.all([api('/me'), api('/meta')]);
  state.user = me.user; state.meta = meta;
  render();
}
window.addEventListener('hashchange', render);
boot();

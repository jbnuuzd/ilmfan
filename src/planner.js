'use strict';
/*
 * Shaxsiy trayektoriya: OAK minimal talablari (requirements jadvali) va tadqiqotchi tanlagan
 * muddat (oy) asosida oyma-oy reja-grafik tuzadi. Yengil topshiriqlar (tezis, impakt/milliy maqola)
 * oldinga, uzoq ko'rib chiqiladigan (Scopus) va ko'p mehnat talab qiladigan (qo'llanma, monografiya) —
 * o'rtaga, hujjatlarni yig'ish va himoyaga tayyorlanish — oxirgi oylarga qo'yiladi.
 */

const KIND_RULES = {
  // from/to — rejaning ulushi (0..1) bo'yicha topshirish oynasi; lead — qabul/chop etishgacha taxminiy oy
  conf_nat:  { from: 0.0,  to: 0.45, lead: 0, label: "Respublika konferensiyasiga tezis topshirish", unit: 'tezis', weight: 1 },
  conf_int:  { from: 0.05, to: 0.55, lead: 1, label: "Xalqaro konferensiyaga tezis/ma'ruza topshirish", unit: 'tezis', weight: 1.5 },
  oak:       { from: 0.12, to: 0.7,  lead: 1, label: "OAK ro'yxatidagi jurnalga maqola topshirish", unit: 'maqola', weight: 2 },
  foreign:   { from: 0.25, to: 0.7,  lead: 3, label: "Xorijiy jurnalga maqola topshirish", unit: 'maqola', weight: 3 },
  scopus:    { from: 0.25, to: 0.7,  lead: 3, label: "Scopus indeksidagi jurnalga maqola topshirish", unit: 'maqola', weight: 3 },
  textbook:  { from: 0.35, to: 0.8,  lead: 1, label: "O'quv qo'llanma tayyorlash va tasdiqlatish", unit: 'qo\'llanma', weight: 4 },
  monograph: { from: 0.45, to: 0.85, lead: 2, label: "Monografiya tayyorlash va nashr etish", unit: 'monografiya', weight: 5 },
  dgu:       { from: 0.4,  to: 0.8,  lead: 1, label: "Intellektual mulk guvohnomasini rasmiylashtirish", unit: 'guvohnoma', weight: 2 },
};

const { CUTOFF } = require('./knowledge');
const MONTHS_UZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

function monthLabel(startMonth, offset) {
  const [y, m] = startMonth.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${MONTHS_UZ[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function currentMonth() { return new Date().toISOString().slice(0, 7); }

function distribute(count, fromIdx, toIdx) {
  // count ta ishni [fromIdx..toIdx] oylari bo'ylab teng taqsimlaydi
  const span = Math.max(1, toIdx - fromIdx + 1);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(Math.min(toIdx, fromIdx + Math.floor(((i + 0.5) * span) / count)));
  }
  return out;
}

function buildPlan({ months, startMonth, requirements, docTemplates, direction }) {
  const M = Math.max(1, Math.min(60, months | 0));
  const start = startMonth || currentMonth();
  const plan = Array.from({ length: M }, (_, i) => ({ index: i + 1, label: monthLabel(start, i), tasks: [] }));
  const warnings = [];
  const endIso = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1 + M, 0)).toISOString().slice(0, 10);
  const newRegime = endIso >= CUTOFF;
  if (newRegime) warnings.push("Rejangiz 2027-yil 1-yanvardan keyin tugaydi: PF-98 bo'yicha avtoreferat chop etish, OAKda mavzu ro'yxati va himoya e'loni, yetakchi tashkilotda muhokama, joriy etish xulosasi va OAK tasdig'i kabi talablar bekor qilinadi (tegishli vazifalar «ixtiyoriy / 2027 dan bekor» deb belgilandi). Yangi nizomlar hali tasdiqlanmagan — «OAK ma'lumotnomasi» sahifasini kuzatib boring.");
  else warnings.push("Rejangiz 2027-yil 1-yanvargacha tugaydi: himoya ESKI tartib bo'yicha o'tadi. OAK himoya e'lonini berib, himoyani 2026-yil oxirigacha o'tkazishga ulgurish uchun muddatlarga qat'iy rioya qiling.");
  const add = (mi, t) => plan[Math.min(M - 1, Math.max(0, mi))].tasks.push(t);

  // 1) Boshlang'ich ishlar
  add(0, { key: 'setup-lit', kind: 'setup', title: "Adabiyotlar sharhi, tadqiqot mavzusi va muammosini aniqlash", weight: 2 });
  add(0, { key: 'setup-journals', kind: 'setup', title: "Platformadagi tavsiya etilgan jurnallar ro'yxatini ko'rib chiqish va maqola uchun jurnallarni tanlash", weight: 1 });
  const topicDoc = docTemplates.find((d) => d.key === 'topic_approval');
  if (topicDoc) add(0, { key: 'doc-topic_approval', kind: 'doc', title: topicDoc.title, weight: 1, docKey: topicDoc.key });

  // 2) Talab qilingan nashrlar
  const lastIdx = M - 1;
  let hardTotal = 0;
  for (const r of requirements) {
    const rule = KIND_RULES[r.kind];
    if (!rule || r.min_count <= 0) continue;
    // oxirgi oylar himoya hujjatlariga ajratiladi; lead vaqtini hisobga olamiz
    const reserve = M >= 6 ? Math.max(1, Math.round(M * 0.15)) : (M >= 3 ? 1 : 0);
    const hardEnd = Math.max(0, lastIdx - reserve - Math.min(rule.lead, Math.max(0, M - 3)));
    let from = Math.min(hardEnd, Math.floor(rule.from * M));
    let to = Math.max(from, Math.min(hardEnd, Math.ceil(rule.to * M) - 1));
    if (rule.lead >= 3 && M < 5) warnings.push(`«${r.title}»: ${M} oylik muddat Scopus/xorijiy jurnal ko'rib chiqish jarayoni (odatda ${rule.lead}+ oy) uchun juda qisqa. Imkon qadar tezroq (1-oyda) topshiring yoki muddatni uzaytiring.`);
    distribute(r.min_count, from, to).forEach((mi, n) => {
      add(mi, { key: `${r.kind}-${n + 1}`, kind: r.kind, title: `${rule.label}${r.min_count > 1 ? ` (${n + 1}/${r.min_count})` : ''}`, weight: rule.weight, reqId: r.id, detail: r.title });
    });
    hardTotal += r.min_count;
  }

  // 3) Hujjatlar
  const phaseRange = { early: [0, Math.max(0, Math.ceil(M * 0.25) - 1)], mid: [Math.floor(M * 0.35), Math.max(Math.floor(M * 0.35), Math.ceil(M * 0.75) - 1)], late: [Math.max(0, lastIdx - Math.max(1, Math.round(M * 0.2)) + 1), lastIdx] };
  const dirTags = new Set(String(direction?.tags || '').split(',').filter(Boolean));
  for (const d of docTemplates) {
    if (d.key === 'topic_approval') continue;
    if (d.directions && !d.directions.split(',').some((t) => dirTags.has(t.trim()))) continue;
    const [a, b] = phaseRange[d.phase] || phaseRange.late;
    const cancelled = !!d.cancelled_from && endIso >= d.cancelled_from;
    add(d.phase === 'mid' ? Math.min(b, a + 1) : a, { key: `doc-${d.key}`, kind: 'doc', title: cancelled ? `${d.title} (2027-yil 1-yanvardan bekor)` : d.title, weight: d.required && !cancelled ? 1.5 : 1, docKey: d.key, optional: !d.required || cancelled, cancelled });
  }
  add(lastIdx, { key: 'final-defense-prep', kind: 'final', title: "Dissertatsiyani himoyaga topshirish: barcha hujjatlar to'plamini yakuniy tekshirish", weight: 3 });

  // Har oyga vazifa ketma-ketligi (barqaror tartib) va takrorlanuvchi key'larni oldini olish
  const seen = new Set();
  plan.forEach((p) => p.tasks.forEach((t) => { while (seen.has(t.key)) t.key += '_'; seen.add(t.key); }));

  const totalWeight = plan.reduce((s, p) => s + p.tasks.reduce((x, t) => x + t.weight, 0), 0);
  return { months: plan, warnings, totalWeight, startMonth: start, hardTotal, newRegime, endIso };
}

function progress(plan, doneKeys) {
  let done = 0, tasksDone = 0, tasksTotal = 0;
  for (const p of plan.months) for (const t of p.tasks) {
    tasksTotal++;
    if (doneKeys.has(t.key)) { done += t.weight; tasksDone++; }
  }
  return { pct: plan.totalWeight ? Math.round((done / plan.totalWeight) * 100) : 0, tasksDone, tasksTotal };
}

function currentIndex(plan, now = currentMonth()) {
  const [sy, sm] = plan.startMonth.split('-').map(Number);
  const [ny, nm] = now.split('-').map(Number);
  return (ny - sy) * 12 + (nm - sm);
}

function endDate(plan) {
  const [y, m] = plan.startMonth.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + plan.months.length, 0));
}

module.exports = { buildPlan, progress, currentIndex, endDate, KIND_RULES, monthLabel, currentMonth };

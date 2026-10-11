'use strict';
/*
 * Sun'iy intellekt qatlami. ANTHROPIC_API_KEY berilsa Claude API ishlatiladi,
 * aks holda qoidaga asoslangan (offline) zaxira matnlar qaytariladi — platforma har holda ishlaydi.
 */
const MODEL = () => process.env.AI_MODEL || 'claude-sonnet-5-5';
const enabled = () => !!process.env.ANTHROPIC_API_KEY;

async function ask(system, user, { maxTokens = 700, timeoutMs = 30000 } = {}) {
  if (!enabled()) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL(), max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.content || []).map((b) => b.text || '').join('').trim() || null;
  } catch { return null; }
}

function extractJson(text) {
  if (!text) return null;
  const m = text.match(/[\[{][\s\S]*[\]}]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

const SYS = "Siz 'Ilmiy yuksalish' platformasining ilmiy maslahatchisisiz. Faqat o'zbek tilida (lotin yozuvi), qisqa, aniq va hurmat bilan yozing. Aniq bilmagan faktlarni to'qimang.";

async function motivation({ name, progressPct, daysLeft, topic, doneTasks, totalTasks, nextTask }) {
  const fallback = fallbackMotivation({ name, progressPct, daysLeft, nextTask });
  const text = await ask(SYS,
    `Tadqiqotchiga 2-3 gapli ilhomlantiruvchi xabar yozing. Ism: ${name}. Mavzu: ${topic || 'kiritilmagan'}. ` +
    `Reja bajarilishi: ${progressPct}% (${doneTasks}/${totalTasks} vazifa). ` +
    `${daysLeft != null ? `Rejadagi yakun muddatigacha ${daysLeft} kun qoldi.` : ''} ${nextTask ? `Eng yaqin vazifa: ${nextTask}.` : ''} ` +
    `"Hurmatli ${name}," bilan boshlang. Quruq raqamlar emas, samimiy va qat'iyatga chorlovchi bo'lsin.`, { maxTokens: 300 });
  return text || fallback;
}

function fallbackMotivation({ name, progressPct, daysLeft, nextTask }) {
  let tone;
  if (progressPct >= 80) tone = "Siz marraga juda yaqinsiz — oxirgi qadamlarni sinchiklab, ishonch bilan bosing.";
  else if (progressPct >= 50) tone = "Yo'lning yarmidan o'tdingiz — endi tezlikni pasaytirmaslik vaqti.";
  else if (progressPct >= 20) tone = "Yaxshi boshlanish bor. Har kuni kichik qadam — oy oxirida katta natija beradi.";
  else tone = "Har bir buyuk tadqiqot bitta kichik qadamdan boshlanadi. Bugun o'sha qadamni qo'ying.";
  return `Hurmatli ${name}, sizning ilmiy tadqiqotingiz hozirda ${progressPct}% bajarilgan. ${tone}` +
    (nextTask ? ` Eng yaqin vazifangiz: «${nextTask}».` : '') +
    (daysLeft != null && daysLeft > 0 ? ` Rejadagi muddatgacha ${daysLeft} kun bor — sizni yanada qattiqroq mehnatga va yuksak natijalarga chorlaymiz!` : ' Sizni yanada muvaffaqiyatga erishish uchun qattiqroq mehnat qilishga chorlaymiz!');
}

/** Jurnal tadqiqotchi uchun qanchalik mos ekanligi: {score:0..100, text} */
async function journalFits(profile, direction, items) {
  const result = new Map();
  for (const it of items) result.set(it.id, heuristicFit(profile, direction, it));
  if (!enabled() || !items.length) return result;
  const list = items.map((j) => ({ id: j.id, name: j.name, quartile: j.quartile, subjects: j.subjects, access: j.access, apc_usd: j.apc_usd, description: j.description, publisher: j.publisher }));
  const text = await ask(SYS + ' Javobni FAQAT JSON massiv sifatida qaytaring.',
    `Tadqiqotchi yo'nalishi: ${direction?.code} ${direction?.name}. Mavzu: ${profile.topic || 'kiritilmagan'}. ` +
    `Quyidagi jurnallarning har biri uchun mavzuga moslikni 0-100 ball bilan baholang va 1-2 gapli o'zbekcha izoh bering ` +
    `(nima uchun mos/mos emas, qabul ehtimoli, qaysi yo'nalishda yozish ma'qul). Jurnal haqida bilmaganingizni to'qimang. ` +
    `Format: [{"id":number,"score":number,"text":string}]\n${JSON.stringify(list)}`, { maxTokens: 2500, timeoutMs: 45000 });
  const arr = extractJson(text);
  if (Array.isArray(arr)) for (const r of arr) if (result.has(r.id) && typeof r.text === 'string') result.set(r.id, { score: Math.max(0, Math.min(100, Math.round(+r.score || 0))), text: r.text.slice(0, 600), ai: true });
  return result;
}

function heuristicFit(profile, direction, j) {
  const score = Math.max(20, Math.min(98, Math.round(j.matchScore ?? 50)));
  const parts = [];
  if (j.tagHits?.length) parts.push(`jurnal mavzulari (${j.tagHits.join(', ')}) sizning yo'nalishingiz bilan mos keladi`);
  if (j.kwHits?.length) parts.push(`mavzuingizdagi «${j.kwHits.join(', ')}» tushunchalari jurnal doirasiga yaqin`);
  if (j.quartile) parts.push(`${j.quartile} kvartil — ${{ Q1: 'eng nufuzli toifa', Q2: 'yuqori nufuzli toifa', Q3: "o'rta toifa, qabul ehtimoli nisbatan yuqori", Q4: 'qabul ehtimoli yuqori toifa' }[j.quartile] || ''}`);
  parts.push(j.acceptance >= 4 ? 'maqola qabul qilinish ehtimoli nisbatan yuqori' : j.acceptance <= 2 ? 'raqobat kuchli, maqola sifatiga yuqori talab' : "qabul ehtimoli o'rtacha");
  return { score, text: parts.join('; ').replace(/^./, (c) => c.toUpperCase()) + '. (Qoidaga asoslangan baho — AI kaliti ulanganda aniqlashtiriladi.)', ai: false };
}

async function summarizeChanges(lines) {
  if (!lines.length) return null;
  return ask(SYS, `Tadqiqotchiga quyidagi jurnal o'zgarishlarini 2-3 gapda tushuntiring va nima qilishini maslahat bering:\n- ${lines.join('\n- ')}`, { maxTokens: 300 });
}

async function planAdvice({ direction, topic, months, summary }) {
  return ask(SYS, `Yo'nalish: ${direction}. Mavzu: ${topic}. Muddat: ${months} oy. Reja xulosasi: ${summary}. 3 ta qisqa amaliy maslahat bering (ro'yxat ko'rinishida).`, { maxTokens: 400 });
}

/** Admin: oak.uz yoki boshqa manbadan ko'chirilgan xom matndan jurnallarni ajratib olish */
async function extractJournals(rawText, hint) {
  const text = await ask(SYS + ' Javobni FAQAT JSON massiv sifatida qaytaring.',
    `Quyidagi matndan ilmiy jurnallarni ajratib oling (${hint}). Har biri uchun: {"name","issn","publisher","oak_status":"active","subjects","access"("free"|"paid")}. ` +
    `Matnda bo'lmagan ma'lumotni to'qimang — bo'sh qoldiring.\n\n${rawText.slice(0, 24000)}`, { maxTokens: 6000, timeoutMs: 60000 });
  return extractJson(text);
}

module.exports = { enabled, motivation, journalFits, summarizeChanges, planAdvice, extractJournals, ask, fallbackMotivation };

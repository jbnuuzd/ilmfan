'use strict';
/*
 * Dissertatsiya ustaxonasi: boblar rejasi, kirish bandlari (OAK majburiy bandlari) va maqola g'oyalari.
 * AI bo'lmasa — shablon (skelet) qaytariladi; barcha matnlar foydalanuvchi tomonidan tahrirlanadi.
 */

// Kirish qismining majburiy bandlari (OAK ma'lumotnomasi, 5-bo'lim)
const INTRO_BANDS = [
  { key: 'dolzarb', title: 'Mavzuning dolzarbligi va zarurati', hint: "Muammoning hozirgi ahamiyati: statistika, hukumat qarorlari/dasturlari, amaliyotdagi ehtiyoj. 1–2 sahifa, raqamli dalillar bilan." },
  { key: 'ustuvor', title: "Respublika fan va texnologiyalari ustuvor yo'nalishlariga mosligi", hint: "Tadqiqot qaysi ustuvor yo'nalishga (masalan, 'axborotlashgan jamiyat', 'ta'lim va madaniyat') mos kelishini ko'rsating." },
  { key: 'xorijiy', title: 'Xorijiy ilmiy tadqiqotlar sharhi', hint: "Faqat DSc uchun majburiy. Mavzu bo'yicha xorijiy mamlakatlardagi asosiy tadqiqotlar va ularning cheklovlari.", dscOnly: true },
  { key: 'organilganlik', title: "Muammoning o'rganilganlik darajasi", hint: "Kim, qachon, nimani o'rgangan; qaysi savollar ochiq qolgan (tadqiqot bo'shlig'i). Mualliflar va asosiy manbalar nomi bilan." },
  { key: 'ilmiy_reja', title: "Dissertatsiya mavzusining muassasa ilmiy rejalari bilan bog'liqligi", hint: "Bajarilgan muassasa/kafedra ilmiy-tadqiqot rejasi, grant yoki loyiha nomi va raqami." },
  { key: 'maqsad', title: 'Tadqiqotning maqsadi', hint: "BITTA aniq gap: nimani ishlab chiqish/asoslash/takomillashtirish. Mavzu sarlavhasi bilan mos bo'lsin." },
  { key: 'vazifalar', title: 'Tadqiqotning vazifalari', hint: "Maqsadga erishish bosqichlari (4–6 ta band); har bir vazifa bitta bobning mazmuniga mos kelsin." },
  { key: 'obyekt', title: "Tadqiqotning obyekti", hint: "Qaysi jarayon/hodisa/muassasa o'rganilayotgani (keng tushuncha)." },
  { key: 'predmet', title: "Tadqiqotning predmeti", hint: "Obyektning aynan qaysi tomoni tadqiq etilishi (torroq tushuncha)." },
  { key: 'usullar', title: 'Tadqiqotning usullari', hint: "Nazariy (tahlil, sintez, modellashtirish) va empirik (kuzatuv, so'rovnoma, tajriba-sinov, statistik tahlil) usullar." },
  { key: 'yangilik', title: 'Tadqiqotning ilmiy yangiligi', hint: "Birinchi marta nima taklif etilgani/asoslangani (3–5 band). 'Birinchi marta', 'takomillashtirilgan', 'ishlab chiqilgan' kabi aniq fe'llar bilan." },
  { key: 'amaliy', title: 'Tadqiqotning amaliy natijalari', hint: "Amaliyotda qo'llanadigan natijalar: metodika, model, tavsiyalar, o'quv-metodik ta'minot." },
  { key: 'joriy', title: 'Tadqiqot natijalarining joriy qilinishi', hint: "Natijalar qayerda, qachon, qaysi hujjat asosida joriy etilgani (dalolatnoma, patent, grant, tavsiya)." },
  { key: 'ishonchlilik', title: 'Tadqiqot natijalarining ishonchliligi', hint: "Nima uchun natijalarga ishonish mumkin: usullar to'g'riligi, tanlanma hajmi, statistik mezonlar, tajriba-sinov." },
  { key: 'ahamiyat', title: 'Tadqiqot natijalarining ilmiy va amaliy ahamiyati', hint: "Fan uchun (nazariyaga qo'shgan hissa) va amaliyot uchun (kim va qanday foydalanadi)." },
  { key: 'aprobatsiya', title: 'Tadqiqot natijalarining aprobatsiyasi', hint: "Natijalar qaysi xalqaro va respublika konferensiya/seminarlarida muhokama qilingani (nomi, sanasi, joyi)." },
  { key: 'elon', title: "Natijalarning e'lon qilinganligi", hint: "Ilmiy ishlar soni, shundan OAK ro'yxatidagi jurnallarda, xorijiy jurnallarda, konferensiya to'plamlarida." },
  { key: 'tuzilma', title: "Dissertatsiyaning tuzilishi va hajmi", hint: "Kirish, boblar soni, xulosa, adabiyotlar ro'yxati (manbalar soni) va ilovalar; jami varaqlar soni." },
];

const SOCIAL_GROUPS = ['Pedagogika', 'Iqtisodiyot', 'Gumanitar'];
const pageLimit = (degree, fieldGroup) => (degree === 'dsc' ? 100 : 60) * (SOCIAL_GROUPS.includes(fieldGroup) ? 1.3 : 1);

function defaultChapters(degree) {
  if (degree === 'dsc') {
    return [['Kirish', 6], ['I bob. Muammoning nazariy-metodologik asoslari', 20], ['II bob. Xorijiy va milliy tajriba tahlili', 22], ['III bob. Modelni/metodikani ishlab chiqish', 22], ['IV bob. Tajriba-sinov va natijalar tahlili', 22], ['Xulosa va takliflar', 8]];
  }
  return [['Kirish', 5], ['I bob. Mavzuning nazariy asoslari', 15], ['II bob. Tadqiqot metodologiyasi va tahlil', 18], ['III bob. Amaliy natijalar va tajriba-sinov', 18], ['Xulosa va takliflar', 4]];
}

/** AI ulanmaganda: bandga shablon (foydalanuvchi tahrirlaydi) */
function templateDraft(band, { topic, direction }) {
  const t = topic || 'tadqiqot mavzusi';
  const T = {
    dolzarb: `«${t}» masalasining dolzarbligi so'nggi yillarda ${direction || 'tegishli soha'}da amalga oshirilayotgan islohotlar bilan belgilanadi. Quyidagilarni yozing: (1) muammoning hozirgi holati va raqamli ko'rsatkichlar; (2) tegishli qaror/dasturlar (nomi, sanasi); (3) amaliyotdagi ehtiyoj va yechilmagan jihatlar.`,
    maqsad: `Tadqiqotning maqsadi — «${t}» bo'yicha nazariy-metodik asoslarni ishlab chiqish, amaliyotga tatbiq etish mexanizmini asoslash va uning samaradorligini tajriba-sinov orqali isbotlashdan iborat.`,
    vazifalar: `Tadqiqotning vazifalari:\n1) mavzu bo'yicha nazariy va me'yoriy manbalarni tahlil qilish, asosiy tushunchalarni aniqlashtirish;\n2) mavjud holat va muammolarni empirik tahlil asosida aniqlash;\n3) ${t} bo'yicha model/metodika ishlab chiqish;\n4) ishlab chiqilgan yondashuvni tajriba-sinovdan o'tkazib, samaradorligini statistik baholash;\n5) amaliy tavsiyalar va takliflar ishlab chiqish.`,
    obyekt: `Tadqiqotning obyekti — «${t}» bilan bog'liq jarayon va uning ishtirokchilari (aniq muassasa/tanlanma hajmini ko'rsating).`,
    predmet: `Tadqiqotning predmeti — obyektning «${t}» jihatidan o'rganilayotgan mazmuni, shakl va usullari.`,
    usullar: `Tadqiqotda nazariy (tahlil, sintez, taqqoslash, modellashtirish) va empirik (kuzatuv, so'rovnoma, suhbat, tajriba-sinov, matematik-statistik qayta ishlash) usullardan foydalanildi.`,
    yangilik: `Tadqiqotning ilmiy yangiligi:\n— birinchi marta ... ishlab chiqilgan;\n— ... mezonlari va ko'rsatkichlari takomillashtirilgan;\n— ... modeli/metodikasi asoslangan va samaradorligi isbotlangan.`,
  };
  return T[band.key] || `${band.title} — ${band.hint}\n\n(Bu band uchun shablon yo'q: yuqoridagi ko'rsatma bo'yicha o'zingiz yozing yoki AI ulangach qoralama oling.)`;
}

function ideaTemplates(topic) {
  const t = topic || 'tadqiqot mavzusi';
  return [
    [`«${t}»ning nazariy-metodologik asoslari`, 'I bob: nazariy tahlil, tushunchalar, tasniflash'],
    [`${t}: xorijiy tajriba tahlili va milliy amaliyotga moslashtirish`, 'Xorijiy modellar taqqoslanadi, milliy sharoitga moslik baholanadi'],
    [`${t}ni takomillashtirishning amaliy mexanizmlari`, 'II bob: muammolar tahlili va taklif etilayotgan mexanizm'],
    [`${t}: tajriba-sinov natijalari (empirical results)`, 'III bob: tajriba va nazorat guruhlari, statistik tahlil, xulosalar (ingliz tilida yozish tavsiya)'],
    [`${t} samaradorligini baholash mezonlari va ko'rsatkichlari`, 'Baholash mezonlari, o\'lchov asboblari, ishonchlilik tahlili'],
    [`${t} bo'yicha so'rovnoma natijalarining tahlili`, 'Respondentlar, tanlanma, asosiy topilmalar'],
    [`${t}ning raqamli vositalari va ulardan foydalanish imkoniyatlari`, 'Texnologik yechimlar, ularning afzallik va cheklovlari'],
    [`${t}: muammolar va rivojlantirish istiqbollari`, 'Xulosa va tavsiyalar, keyingi tadqiqot yo\'nalishlari'],
  ];
}

/** requirements (oak/foreign/conf_int/conf_nat) bo'yicha g'oyalar skeleti (AI bo'lmasa yoki to'ldirish uchun) */
function fallbackIdeas(topic, requirements, chapters) {
  const tpl = ideaTemplates(topic);
  const chapterTitles = chapters.filter((c) => /bob/i.test(c.title)).map((c) => c.title);
  const out = [];
  let i = 0;
  for (const r of requirements) {
    if (!['oak', 'foreign', 'conf_int', 'conf_nat'].includes(r.kind)) continue;
    for (let n = 0; n < r.min_count; n++, i++) {
      const [title, outline] = tpl[i % tpl.length];
      out.push({ title, kind: r.kind, chapter: chapterTitles.length ? chapterTitles[i % chapterTitles.length] : '', outline });
    }
  }
  return out;
}

module.exports = { INTRO_BANDS, pageLimit, defaultChapters, templateDraft, fallbackIdeas, SOCIAL_GROUPS };

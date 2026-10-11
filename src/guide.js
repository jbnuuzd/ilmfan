'use strict';
/*
 * Jurnal bo'yicha batafsil qo'llanma: umumiy ma'lumot, maqolani rasmiylashtirish tavsiyalari va
 * yuborish bosqichlari. Asosiy qism qoidaga asoslangan (har doim ishlaydi); AI kaliti bo'lsa,
 * foydalanuvchi mavzusiga moslashtirilgan qo'shimcha maslahatlar ham qo'shiladi.
 * Jurnalning o'z "Guide for Authors" hujjati har doim ustuvor — bu yerda umumiy amaliyot keltirilgan.
 */

// Nashriyot -> odatdagi yuborish tizimi (taxminiy; jurnal saytidagi "Submit" havolasi ustuvor)
const SYSTEMS = [
  [/elsevier|cell press/i, "Editorial Manager (Elsevier), jurnal sahifasidagi «Submit your paper» tugmasi orqali"],
  [/mdpi/i, "MDPI SuSy (susy.mdpi.com) — jurnal sahifasidagi «Submit» tugmasi orqali; avval ro'yxatdan o'tiladi"],
  [/springer/i, "Springer Nature yuborish tizimi / Editorial Manager — jurnal sahifasidagi «Submit manuscript»"],
  [/taylor|routledge/i, "ScholarOne Manuscripts yoki Editorial Manager — jurnal sahifasidagi «Submit an article»"],
  [/wiley/i, "Wiley Research Exchange / ScholarOne — jurnal sahifasidagi «Submit an article»"],
  [/sage/i, "SAGE Track (ScholarOne) — jurnal sahifasidagi «Submit your manuscript»"],
  [/emerald/i, "ScholarOne Manuscripts — jurnal sahifasidagi «Submit your manuscript»"],
  [/ieee/i, "IEEE ScholarOne / Author Portal — jurnal sahifasidagi «Submit manuscript»"],
  [/frontiers/i, "Frontiers yuborish tizimi — tadqiqot mavzusi (Research Topic) yoki jurnal sahifasi orqali"],
  [/plos/i, "Editorial Manager (PLOS) — jurnal sahifasidagi «Submit your manuscript»"],
  [/nature|bmc/i, "Springer Nature yuborish tizimi — jurnal sahifasidagi «Submit manuscript»"],
  [/bmj/i, "ScholarOne Manuscripts (BMJ) — jurnal sahifasidagi «Submit»"],
];
const submissionSystem = (j) => (SYSTEMS.find(([re]) => re.test(j.publisher || '')) || [])[1]
  || "Jurnal saytidagi «For authors / Submit / Guide for Authors» bo'limida ko'rsatilgan yuborish tizimi (odatda Open Journal Systems, Editorial Manager yoki elektron pochta)";

const weeks = (n) => (n ? `taxminan ${n} hafta` : "jurnal saytida ko'rsatilgan muddat (odatda 4–16 hafta)");
const q = (j) => j.quartile || '—';

function overview(j, category, fit) {
  const rows = [];
  rows.push(['Nashriyot / mamlakat', [j.publisher, j.country].filter(Boolean).join(', ') || "ko'rsatilmagan"]);
  if (j.since_year) rows.push(['Qachondan beri chiqadi', `${j.since_year}-yildan`]);
  if (j.issn) rows.push(['ISSN', j.issn]);
  const idx = [];
  if (j.scopus_status === 'active') idx.push(`Scopus (${q(j)} kvartil)`); else if (j.scopus_status === 'discontinued') idx.push("Scopus — indekslash TO'XTATILGAN");
  if (j.wos === 1) idx.push(j.if_source === 'esci' ? 'Web of Science (ESCI)' : 'Web of Science');
  if (j.oak_status === 'active') idx.push("OAK tavsiya etgan ro'yxatda"); else if (j.oak_status === 'removed') idx.push("OAK ro'yxatidan chiqarilgan");
  rows.push(['Indekslanishi', idx.join('; ') || "Ma'lumot yo'q — tekshiring"]);
  if (j.impact_factor != null) rows.push(['Impakt faktor', `≈ ${j.impact_factor}${j.if_source === 'jcr' ? ' (Clarivate JCR)' : j.if_source === 'alt' ? " (muqobil xizmat — OAK tan olmaydi)" : ''}`]);
  rows.push(['Nashr uchun to‘lov', j.access === 'free' ? "Mualliflardan to'lov talab qilinmaydi" : (j.apc_usd ? `≈ ${j.apc_usd} USD (APC; tasdiqlangandan keyin to'lanadi)` : "Pullik — narxni jurnal saytidan aniqlang")]);
  rows.push(['Ko‘rib chiqish muddati', weeks(j.review_weeks)]);
  rows.push(['Qabul ehtimoli', `${j.acceptance || 3}/5 ${(j.acceptance || 3) >= 4 ? '(nisbatan yuqori)' : (j.acceptance || 3) <= 2 ? '(raqobat kuchli)' : '(o‘rtacha)'}`]);
  if (j.subjects) rows.push(['Mavzu teglari', j.subjects.split(',').join(', ')]);
  if (fit?.fit_text) rows.push(['Sizga moslik', `${fit.fit_score != null ? fit.fit_score + '% — ' : ''}${fit.fit_text}`]);
  return rows;
}

function preparation(j, category, direction) {
  const social = /pedagog|iqtisod|gumanitar|geograf/i.test(direction?.field_group || '');
  const sections = [];
  if (category === 'conference') {
    sections.push({ title: 'Tezis / ma’ruza tayyorlash', items: [
      "Konferensiyaning «Call for Papers» sahifasidagi mavzular, tezis hajmi (odatda 250–500 so'z abstract yoki 4–8 bet maqola) va shablonini aniqlang.",
      "Tezisda: muammo → maqsad → usul → asosiy natija → xulosa tuzilmasini saqlang; mavzu dissertatsiya ishingizga bevosita bog'liq bo'lsin.",
      "Ingliz tilidagi matnni til tahriridan o'tkazing; shablon (Word/LaTeX) talablariga qat'iy rioya qiling.",
      "Konferensiya to'plami qaysi bazalarda (Scopus/WoS) indekslanishini tashkilotchilardan yozma so'rang — har bir to'plam indekslanavermaydi.",
      "OAK talabi uchun: xalqaro konferensiya to'plamidagi material, ISBN/ISSN, tashkilotchilar va tahrir hay'ati ma'lumotlarini saqlab qo'ying.",
    ] });
    return sections;
  }
  sections.push({ title: 'Maqola tuzilishi va mazmuni', items: [
    "Mavzu va maqsad jurnal doirasi (Aims & Scope) bilan to'liq mos bo'lsin — doiradan tashqari maqolalar ko'pincha tahrirchi bosqichida (desk reject) rad etiladi.",
    "Sarlavha aniq va qisqa; annotatsiya (abstract) 150–250 so'z: muammo, usul, asosiy natija, ilmiy yangilik; 4–6 ta kalit so'z.",
    "Tuzilma (IMRaD): Kirish (muammo va tadqiqot bo'shlig'i), Adabiyotlar sharhi, Metodologiya, Natijalar, Muhokama, Xulosa, Cheklovlar va keyingi tadqiqotlar.",
    "Metodologiyani takrorlash mumkin bo'ladigan darajada yozing: tanlanma hajmi, tajriba/nazorat guruhlari, o'lchov asboblari, statistik mezonlar.",
    "Adabiyotlarning katta qismi so'nggi 5 yillik, ishonchli (Scopus/WoS) manbalardan bo'lsin; jurnalning o'zidan 2–5 ta tegishli maqolaga havola qilish muhokamaga mosligini ko'rsatadi.",
    "Iqtiboslar jurnal talab qilgan uslubda (APA, Harvard, Vancouver va h.k.) — Mendeley/Zotero kabi dasturlardan foydalaning.",
  ] });
  sections.push({ title: 'Rasmiylashtirish va sifat nazorati', items: [
    "Jurnalning «Guide for Authors» hujjatini oxirigacha o'qing: hajm, shrift, jadval/rasm sifati, ilovalar, so'z limiti.",
    "Antiplagiat tekshiruvi (iThenticate/Turnitin yoki rasmiy antiplagiat): umumiy o'xshashlik odatda 15–20% dan oshmasligi, bitta manbadan o'xshashlik 3–5% dan past bo'lishi kutiladi.",
    "Ingliz tilidagi matnni professional til tahriridan o'tkazing; Grammarly kabi vositalar yetarli emas, lekin yordam beradi.",
    "Etika: odamlar ishtirokidagi tadqiqotda axloq qo'mitasi ruxsati va ishtirokchilarning roziligini ko'rsating; ma'lumotlar mavjudligi (Data availability) bayonotini qo'shing.",
    "Barcha mualliflar uchun ORCID oling; muallif hissasi (CRediT), moliyalashtirish va manfaatlar to'qnashuvi bayonotlarini tayyorlang.",
    "Taqdimot xati (cover letter): maqolaning yangiligi, jurnal auditoriyasi uchun ahamiyati va boshqa jurnalga yuborilmaganligi haqida 1 sahifalik xat.",
  ] });
  if (category === 'oak' || j.oak_status !== 'none') {
    sections.push({ title: "OAK talablari bo'yicha alohida eslatmalar", items: [
      "Maqola hajmi odatda kamida 0,25 b.t.; o'zbek, ingliz va rus tillarida annotatsiya, kalit so'zlar va adabiyotlar ro'yxati bo'lishi kerak (OAK milliy jurnal talablari).",
      social ? "Ijtimoiy-gumanitar soha (pedagogika, iqtisodiyot va h.k.): asosiy ilmiy ishlar YAKKA mualliflikda bo'lishi kerak." : "Hammualliflikda chop etilsa, hammualliflarning yozma roziligi talab qilinadi.",
      "Maqolada dissertatsiya mavzusi bilan bog'liqlik aniq ko'rinsin; natijalar dissertatsiya boblariga mos kelsin.",
      "Chop etilgach: jurnalning OAK ro'yxatidagi holatini (oak.uz/pages/31738) maqola chiqqan sanaga tekshiring va skrinshot/havolani saqlang.",
    ] });
  }
  if (category === 'scopus' || category === 'impact' || j.scopus_status === 'active') {
    sections.push({ title: 'Scopus / WoS maqolasi uchun qo\'shimcha', items: [
      "Yuborishdan oldin jurnalning Scopus (scopus.com/sources) va OAK «Scopus'dan chiqarilganlar» ro'yxatida emasligini tekshiring; maqola chiqqanda ham yana tekshiring.",
      "Dissertatsiya uchun «nufuzli xorijiy jurnal» sifatida Scopus/Web of Science'dagi FAOL indekslangan jurnal eng xavfsiz yo'l (OAK 10.06.2026 qoidasi).",
      "Q1–Q2 jurnallarga yuborishda yangilik darajasi, katta tanlanma va chuqur adabiyotlar sharhi talab qilinadi; rad etilsa, taqrizchi izohlari bilan Q3–Q4 jurnalga moslashtirib qayta yuboring.",
      "Bir vaqtning o'zida bir nechta jurnalga yubormang (takroriy yuborish — axloqiy buzilish).",
    ] });
  }
  if (category === 'impact_lite' || j.scopus_status === 'none' && j.oak_status === 'none') {
    sections.push({ title: "Scopus'da indekslanmagan arzon nashr: ehtiyot choralari", items: [
      "Jurnalning Web of Science (Master Journal List) va DOAJ'dagi holatini tekshiring — bu jurnalning ishonchliligi uchun asosiy belgi.",
      j.if_source === 'alt' ? "Bu nashrning «impakt faktori» muqobil xizmatlardan olingan: OAK bunday xizmatlarni (SJIF, GIF, Index Copernicus va h.k.) tan olmaydi — maqola dissertatsiya talabini TO'LDIRMASLIGI mumkin." : "Scopus'da yo'qligi OAK uchun to'siq bo'lishi mumkin: dissertatsiyada «xorijiy nufuzli jurnal» talabi uchun avval OAK / dissertatsiya kengashi bilan tasdiqlang.",
      "«Tez chop etish», kafolatlangan qabul yoki sohta indeksatsiya va'da qilgan jurnallardan qoching (OAK 17.06.2026 ogohlantirishi).",
      "To'lovni faqat rasmiy hisob-faktura (invoice) asosida, maqola qabul qilingandan keyin va tasdiqlangan rekvizitlarga to'lang.",
    ] });
  }
  return sections;
}

function steps(j, category) {
  const sys = submissionSystem(j);
  const rw = j.review_weeks || 8;
  if (category === 'conference') {
    return [
      ['Konferensiyani tanlash va tekshirish', "Rasmiy saytdagi sanalar, mavzular, to'plam indekslanishi (Scopus/WoS) va ishtirok to'lovini aniqlang. Tashkilotchilarning haqiqiyligini (tahrir hay'ati, oldingi yillar to'plamlari) tekshiring.", '1–2 kun'],
      ['Tezis/maqola tayyorlash', "Shablon bo'yicha matnni yozing, ingliz tilini tahrirlang, antiplagiat tekshiruvidan o'tkazing.", '1–3 hafta'],
      ['Yuborish', "Konferensiya saytidagi (EasyChair, ConfTool va h.k.) forma orqali tezisni yuklang; mualliflar va ORCID ma'lumotlarini kiriting.", '1 kun'],
      ['Ko‘rib chiqish va qabul', "Ilmiy qo'mita taqrizi; qabul xati (Letter of Acceptance) keladi. Viza/ruxsat kerak bo'lsa, shu xatdan foydalaniladi.", '2–6 hafta'],
      ['Ro‘yxatdan o‘tish va to‘lov', "Ishtirok (registration) to'lovi invoice orqali; Online/offline formatni tanlang.", '1–2 hafta'],
      ['Taqdimot', "Slayd va ma'ruzani tayyorlang; savol-javoblarga tayyorgarlik ko'ring. Ma'ruza qilganingizni tasdiqlovchi sertifikat oling.", 'konferensiya kuni'],
      ['Nashrdan keyingi ishlar', "To'plam (proceedings) chop etilgach nusxa, ISBN/ISSN, DOI va indekslanganlik isbotini saqlang; platformadagi trayektoriyada vazifani «bajarildi» deb belgilang.", '1–6 oy'],
    ].map(([title, detail, duration]) => ({ title, detail, duration }));
  }
  if (category === 'oak' || (j.oak_status === 'active' && j.scopus_status === 'none')) {
    return [
      ['Jurnalni tekshirish', "oak.uz/pages/31738 reyestrida jurnalning holati «Faol» va fan tarmog'ingiz (masalan 08.00.00 / 13.00.00) mosligini tekshiring; jurnalning rasmiy saytini toping.", '1 kun'],
      ['Talablarni o‘rganish', "Tahririyatning maqola talablari: hajm, shrift, adabiyotlar uslubi, annotatsiya (3 tilda), kalit so'zlar, taqriz va to'lov shartlari.", '1–2 kun'],
      ['Maqola tayyorlash', "Dissertatsiya bobiga mos maqolani yozing; antiplagiat tekshiruvidan o'tkazing; ilmiy rahbar fikrini oling.", '1–3 hafta'],
      ['Tahririyatga yuborish', `${sys}. Odatda maqola matni, ilmiy rahbar taqrizi (kerak bo'lsa), muallif ma'lumotlari va ariza yuboriladi.`, '1 kun'],
      ['Taqriz va tahrir', `Mutaxassis taqrizi va tahririyat tomonidan ko'rib chiqish — ${weeks(Math.min(rw, 8))}. Izohlar bo'yicha maqolani tuzating.`, `${Math.min(rw, 8)} hafta atrofida`],
      ['Qabul va to‘lov', j.access === 'free' ? "Qabul qilingach, nashr navbatiga qo'yiladi (to'lov talab qilinmaydi)." : "Qabul xati va to'lov shartlari (invoice) keladi; rasmiy rekvizitlar bo'yicha to'lang va kvitansiyani saqlang.", '1–2 hafta'],
      ['Chop etilishi', "Jurnal soni chiqadi: maqola sahifalari, jurnal tashqi va ichki muqovasi (tahririyat/ISSN) nusxasini, «chop etilganlik ma'lumotnomasi»ni oling.", '1–3 oy'],
      ['Hujjatlarni saqlash', "Maqola nusxasi + jurnalning OAK ro'yxatidagi holati (skrinshot, sana) + sertifikat/ma'lumotnomani dissertatsiya hujjatlariga joylang va platformada vazifani belgilang.", 'chop etilgach'],
    ].map(([title, detail, duration]) => ({ title, detail, duration }));
  }
  const apcLine = j.access === 'free'
    ? "Mualliflardan to'lov talab qilinmaydi (bu jurnal uchun)."
    : `Maqola qabul qilingach hisob-faktura (invoice) keladi${j.apc_usd ? ` (≈ ${j.apc_usd} USD)` : ''}; chegirma (waiver) imkoniyatini yuborishdan oldin so'rang — rivojlanayotgan mamlakatlar mualliflariga ko'pincha beriladi.`;
  return [
    ['Jurnal va indeksni tekshirish', "Scopus Sources (scopus.com/sources) va/yoki Web of Science Master Journal List'da jurnal FAOLLIGINI, kvartilini va OAK «Scopus'dan chiqarilganlar» ro'yxatida emasligini tekshiring.", '1 kun'],
    ['Aims & Scope va Guide for Authors', "Mavzu mosligi, maqola turlari (Research article, Review), so'z limiti, adabiyotlar uslubi, ochiq ma'lumotlar siyosati va ko'rib chiqish turi (single/double-blind)ni o'qing.", '1–2 kun'],
    ['Maqola tayyorlash', "IMRaD tuzilmasi, tahlil, jadval va rasmlar; hammualliflar va ularning hissasi (CRediT) aniqlanadi.", '3–8 hafta'],
    ['Sifat nazorati', "Antiplagiat, til tahriri, adabiyotlar tekshiruvi, etika va ma'lumotlar mavjudligi bayonotlari, ilmiy rahbar/hammualliflar ko'rib chiqishi.", '1–2 hafta'],
    ['Akkaunt va ORCID', "Barcha mualliflar uchun ORCID; yuborish tizimida muallif akkaunti ochiladi (tashkilot nomi, elektron pochta — imkon bo'lsa institutsional).", '1 kun'],
    ['Yuborish (Submission)', `${sys}. Fayllar: asosiy matn (muallifsiz — double-blind bo'lsa), titul sahifa, rasm/jadvallar, cover letter, bayonotlar; tavsiya etilgan taqrizchilar (agar so'ralsa).`, '1 kun'],
    ['Texnik tekshiruv va tahrirchi ko‘rigi', "Tahririyat formatni va doiraga mosligini tekshiradi; mos kelmasa «desk reject» bo'ladi (odatda 1–3 hafta ichida).", '1–3 hafta'],
    ['Peer review (taqrizlash)', `Odatda 2–3 mustaqil taqrizchi baholaydi: ${weeks(rw)}. Holat tizimda «Under review» ko'rinadi. Muddat oshsa, muloyim eslatma xati yuboring.`, `${rw} hafta atrofida`],
    ['Qaror', "Accept / Minor revision / Major revision / Reject. Revision bo'lsa, odatda 2–8 hafta muddat beriladi.", '—'],
    ['Revision va javob xati', "Har bir taqrizchi izohiga punkt-ma'punkt javob (Response letter) yozing: nima o'zgartirildi, qaysi betda; rozi bo'lmasangiz — asosli dalil keltiring. Tuzatilgan matnni yuboring.", '2–4 hafta'],
    ['Qabul, litsenziya va to‘lov', apcLine, '1–2 hafta'],
    ['Proof (korrektura)', "Nashriyot yuborgan tahrirlangan variantni (proof) diqqat bilan o'qib, ism, tashkilot, jadval va adabiyotlarni tekshiring; tez javob bering.", '2–5 kun'],
    ['Chop etilishi', "Maqola DOI bilan onlayn chiqadi (online first), keyin jurnal soniga kiritiladi.", '1–4 hafta'],
    ['Nashrdan keyingi ishlar', "Maqola Scopus/WoS profilida paydo bo'lishini kuzating (odatda bir necha hafta); ORCID'ga qo'shing; PDF, DOI va jurnalning indekslanganlik isbotini (Scopus Sources sahifasi skrinshoti) dissertatsiya hujjatlariga joylang; platformada vazifani belgilang.", 'chop etilgach'],
  ].map(([title, detail, duration]) => ({ title, detail, duration }));
}

function warnings(j, category) {
  const w = [];
  if (j.scopus_status === 'discontinued') w.push("Bu jurnal Scopus indeksidan chiqarilgan (yoki faolligi to'xtatilgan) — yuborishdan oldin shaxsan tekshiring.");
  if (j.oak_status === 'removed') w.push("Bu jurnal OAK ro'yxatidan chiqarilgan — yangi maqolalar hisobga olinmasligi mumkin.");
  if (j.if_source === 'alt') w.push("Muqobil «impakt faktor» OAK tomonidan tan olinmaydi (2024-yil 30-mart qaroridan keyin).");
  if (!j.verified) w.push("Jurnal haqidagi ma'lumotlar rasmiy manbalar bilan tasdiqlanmagan (namuna) — kvartil, to'lov va indekslanishni jurnal saytida hamda Scopus/WoS'da tekshiring.");
  w.push("DOI berilishi, ResearchGate yoki Google Scholar'da ko'rinishi jurnalning sifat mezoni emas (OAK izohi). «Tez chop etish» va'dalaridan ehtiyot bo'ling.");
  return w;
}

function buildGuide(j, { category, direction, fit } = {}) {
  return {
    overview: overview(j, category, fit),
    links: [
      j.official_url ? ["Jurnalning rasmiy sayti", j.official_url] : ["Rasmiy saytni qidirish", `https://www.google.com/search?q=${encodeURIComponent(`${j.name} author guidelines`)}`],
      ...(j.kind !== 'conference' && j.scopus_status !== 'none' ? [["Scopus'da tekshirish", j.scopus_url || `https://www.scimagojr.com/journalsearch.php?q=${encodeURIComponent(j.name)}`]] : []),
      ...(j.oak_status !== 'none' ? [["OAK nashrlar reyestri", j.oak_url || 'https://oak.uz/pages/31738']] : []),
      ...(j.kind !== 'conference' ? [["Web of Science Master Journal List (indekslanishni tekshirish)", 'https://mjl.clarivate.com/home']] : []),
    ].filter((l) => l[1]),
    system: submissionSystem(j),
    preparation: preparation(j, category, direction),
    steps: steps(j, category),
    warnings: warnings(j, category),
  };
}

module.exports = { buildGuide, submissionSystem };

'use strict';
/*
 * OAK (oak.uz) rasmiy ma'lumotnomasidan (2026-yil 11-oktabr holati; to'liq matn: src/data/oak_reference.md)
 * olingan tayanch bilimlar. Tadqiqotchi kabinetidagi «OAK ma'lumotnomasi» sahifasi shuni ko'rsatadi.
 */
const SOURCES = {
  pf98: 'https://lex.uz/uz/docs/8236683',
  degrees: 'https://lex.uz/uz/docs/3244217',
  titles: 'https://lex.uz/uz/docs/2971437',
  journals: 'https://oak.uz/pages/31738',
  scopusOut: 'https://oak.uz/userfiles/files/2%20Discontinued-sources-from-Scopus-January_2026.xlsx',
  specialties: "https://oak.uz/userfiles/files/Ixtisosliklar_ro'yxati_2025.pdf",
};

const CUTOFF = '2027-01-01'; // PF-98 bo'yicha eski tartib bekor bo'ladigan sana

const knowledge = {
  asOf: '2026-10-11',
  warning: "2026-yil 26-maydagi PF-98 Farmoni sababli tizim o‘zgarish jarayonida. 2027-yil 1-yanvardan ko‘plab tartiblar bekor bo‘ladi; yangi nizomlar 2026-yil oktabr–dekabrda tasdiqlanishi kutilmoqda. Hujjat topshirishdan oldin oak.uz va lex.uz dagi eng so‘nggi tahrirni tekshiring.",
  sections: [
    {
      title: 'PhD (Falsafa doktori) — amaldagi talablar',
      source: SOURCES.degrees,
      items: [
        'Dissertatsiya bo‘yicha jami ilmiy ishlar — kamida 7 ta.',
        'Shundan kamida 3 ta ilmiy maqola OAK tavsiya etgan ro‘yxatdagi nashrlarda, jumladan 1 tasi nufuzli xorijiy ilmiy jurnalda.',
        'Kamida 2 ta material (maqola, ma’ruza yoki tezis) xalqaro konferensiya to‘plamida.',
        'Ijtimoiy-gumanitar fanlarda (jumladan iqtisodiyot, pedagogika) asosiy ilmiy ishlar yakka mualliflikda bo‘lishi kerak.',
        'Natijalar xalqaro va respublika konferensiya/seminarlarida aprobatsiyadan o‘tgan bo‘lishi shart.',
        'Dissertatsiya: kirish, kamida 3 bob, xulosalar, adabiyotlar; matn 60 varaqdan oshmasin (ijtimoiy-gumanitarda 30% gacha ko‘p bo‘lishi mumkin).',
        'Dastlabki ekspertiza (muassasa ilmiy seminari) xulosasi 2 oy ichida beriladi.',
      ],
    },
    {
      title: 'DSc (Fan doktori) — amaldagi talablar',
      source: SOURCES.degrees,
      items: [
        'Jami ilmiy ishlar — kamida 15 ta; shundan ro‘yxatdagi nashrlarda kamida 10 ta maqola, ulardan 1 tasi rivojlangan xorijiy mamlakatning nufuzli ixtisoslashgan jurnalida.',
        'Kamida 2 ta xalqaro konferensiya materiali.',
        'Ijtimoiy-gumanitar fanlarda monografiya (2027-yil 1-yanvardan bu talab bekor qilinadi).',
        'Dissertatsiya: kamida 4 bob; matn 100 varaqdan oshmasin (ijtimoiy-gumanitarda +30%). Kirish qismida xorijiy tadqiqotlar sharhi faqat DSc uchun.',
        'Ilmiy ma’ruza shaklida himoya faqat DSc uchun (OAK Rayosati ruxsati bilan).',
        'Dastlabki ekspertiza xulosasi 3  oy ichida.',
      ],
    },
    {
      title: 'Nashrlarni hisoblash qoidalari',
      source: SOURCES.degrees,
      items: [
        'Patentlar, preprintlar, ilmiy xaritalar va konferensiya tezislari ham ilmiy ishlar qatoriga kiradi.',
        'O‘quv adabiyotlari, jumladan darsliklar, ilmiy ishlar qatoriga KIRMAYDI.',
        'Kengash qarori bilan chop etilgan, kamida 6 b.t. yakka mualliflik monografiyasi milliy nashrlardagi 3 ta maqolaga (hammualliflikda 2 taga) tenglashtiriladi.',
        'Nashrga topshirilgan, lekin hali chiqmagan ishlar hisobga olinmaydi.',
        'Hammualliflikdagi maqolalar uchun hammualliflarning yozma roziligi kerak.',
        'Boshqa muallif materialidan manbasiz foydalanilsa — dissertatsiya muhokamadan olinadi va shu mavzuda qayta himoya huquqi yo‘qotiladi.',
      ],
    },
    {
      title: 'PF-98 (26.05.2026): 2027-yil 1-yanvardan bekor qilinadigan tartiblar',
      source: SOURCES.pf98,
      items: [
        'Chet tili bo‘yicha malakaviy imtihon (mustaqil izlanuvchilar bundan mustasno).',
        'Dissertatsiya mavzularini OAKda ro‘yxatdan o‘tkazish va himoya haqida OAK tomonidan e’lon berish.',
        'Dissertatsiyani yetakchi tashkilotda muhokamadan o‘tkazish.',
        'Ijtimoiy-gumanitar fanlar bo‘yicha DSc uchun monografiya talabi.',
        'Dissertatsiya avtoreferatini chop etish.',
        'Ilmiy natija amaliyotga joriy etilganligi to‘g‘risida xulosa olish.',
        'OAK ekspert kengashlari tomonidan ilmiy ekspertiza.',
        'Ilmiy kengash qarorini OAK tomonidan tasdiqlash (daraja ilmiy kengash qarori bilan beriladi).',
        'O‘tish qoidasi: 2027-yil 1-yanvargacha OAK himoya e’lonini bergan va himoyani o‘tkazganlarga daraja ESKI tartib bo‘yicha beriladi.',
      ],
    },
    {
      title: 'Xalqaro bazalar — 10.06.2026 dagi yangi qoida',
      source: SOURCES.journals,
      items: [
        'A toifa (iqtibos va tahliliy bazalar): Web of Science, Scopus, Journal Citation Reports.',
        'B toifa (ixtisoslashgan): AGRIS (qishloq xo‘jaligi), Chemical Abstracts Service (kimyo), GeoRef (geologiya), PubMed (tibbiyot), Compendex (muhandislik).',
        'C toifa (ijtimoiy-gumanitar): Anthropological Index Online, Anthropological Literature, Anthropology Plus, Bibliography of Asian Studies.',
        'Mustaqil mezon sifatida QO‘LLANILMAYDI: Springer, Index Copernicus, BASE, ResearchBib, CiteFactor, Ulrich’s, DOAJ, Asian Education Index, CrossRef, HINARI, Hindawi, ResearchGate, SCImago, Scisearch.',
        'Impakt-faktor xizmatlari (Global/International/General Impact Factor, SJIF, DRJI, OAJI va h.k.) 30.03.2024 dan chiqarilgan.',
        'DOI berilishi, ResearchGate’da joylashtirilishi yoki analitik platformalarda ko‘rinishi o‘z-o‘zidan yetarli asos emas.',
        'Eng xavfsiz yo‘l — xorijiy maqolani Scopus yoki Web of Science’da FAOL indekslangan jurnalda chop etish.',
      ],
    },
    {
      title: 'Ehtiyot bo‘ling: shubhali va klon jurnallar',
      source: SOURCES.scopusOut,
      items: [
        'OAK Scopus’dan chiqarilgan jurnallar ro‘yxatini e’lon qilgan (2026-yil yanvar holati) — topshirishdan oldin tekshiring.',
        'Tez chop etish va soddalashtirilgan qabul va’da qiladigan, sohta indeksatsiya ko‘rsatadigan klon jurnallardan ehtiyot bo‘ling (OAK ogohlantirishi, 17.06.2026).',
        '10.06.2026 da OAK ro‘yxatidan 37 ta xorijiy jurnal chiqarildi; shu sanagacha chiqarilgan jurnallardagi maqolalar belgilangan tartibda hisobga olinadi.',
      ],
    },
    {
      title: 'Doktorantura va yangi dasturlar (PF-98)',
      source: SOURCES.pf98,
      items: [
        'Doktorantura kvotasining kamida 60% ustuvor yo‘nalishlarga ajratiladi (raqamli texnologiyalar, energetika, agroinnovatsiyalar, tibbiyot va biotexnologiyalar, suv resurslari, yangi materiallar, seysmik xavfsizlik).',
        'Ustuvor ixtisosliklar doktorantlariga stipendiya 1,7 barobar.',
        '«Loyiha doirasida ilmiy daraja» va «Amaliy doktorantura (PhD)» dasturlari 2027-yil yanvaridan.',
        'Ilmiy kengashlar reytingi va yagona onlayn himoya tizimi 2026-yil dekabrgacha joriy etilishi kutilmoqda.',
      ],
    },
    {
      title: 'Ilmiy natijani joriy etish shakllari',
      source: SOURCES.degrees,
      items: [
        'Joriy etish haqida xulosa olish talabi 2027-yil 1-yanvardan bekor bo‘ladi, ammo natijaning ahamiyati baribir baholanadi.',
        'Shakllari: ixtiro/foydali modelga patent; nufuzli markaz yoki OTM e’tirofi yoki impakt-faktori 0,5 dan yuqori xalqaro jurnallarda kamida 3 ta havola; tugallangan grant loyihasida foydalanilishi; davlat reyestriga kiritilishi; norma ijodkorligi (NHH) da foydalanilishi.',
        'PhD uchun: o‘quv qo‘llanmaning ta’lim jarayoniga tatbiq etilishi; davlat organi yoki xo‘jalik boshqaruvi organi ilmiy-texnik kengashi tavsiyasi; innovatsion yarmarkada imzolangan shartnomalar.',
      ],
    },
  ],
  links: [
    ['OAK nashrlar reyestri (jurnallar ro‘yxati)', SOURCES.journals],
    ['PF-98 Farmoni (26.05.2026)', SOURCES.pf98],
    ['Ilmiy darajalar berish tartibi nizomi', SOURCES.degrees],
    ['Ilmiy unvonlar berish tartibi nizomi', SOURCES.titles],
    ['Ixtisosliklar ro‘yxati (2025)', SOURCES.specialties],
    ['Scopus’dan chiqarilgan jurnallar (2026-yan.)', SOURCES.scopusOut],
    ['OAK himoya e’lonlari', 'https://oak.uz/page/8'],
    ['OAK rasmiy Telegram kanali', 'https://t.me/attestatsiya'],
  ],
};

module.exports = { knowledge, SOURCES, CUTOFF };

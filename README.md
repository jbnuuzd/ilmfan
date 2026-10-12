# 🎓 Ilmiy yuksalish

Tadqiqotchilar (doktorant, mustaqil izlanuvchi, yangi boshlovchi) uchun tavsiyaviy platforma:
Scopus / OAK / yuqori impakt faktorli jurnallar va konferensiyalar, OAK minimal talablari,
oyma-oy shaxsiy trayektoriya, himoya hujjatlari ro'yxati va sun'iy intellekt ko'magi.

## Cloudflare'ga joylash (GitHub → Cloudflare Workers)

Platforma **Cloudflare Workers + D1 (SQLite) + statik fayllar** uchun moslangan. Server kodi `src/worker.mjs`, ma'lumotlar bazasi — D1 (`DB` bog'lanmasi),
frontend — `public/` (Workers Static Assets). Sxema va boshlang'ich ma'lumotlar (jurnallar, talablar, hujjatlar) birinchi so'rovda **avtomatik** yaratiladi — migratsiya buyruqlari kerak emas.

**1. D1 bazasini yaratish** (bir marta; ikkita yo'l):
* *Avtomatik:* `wrangler.jsonc` da `database_id` ko'rsatilmagan — yangi wrangler deploy paytida bazani o'zi yaratadi.
* *Qo'lda (agar avtomatik ishlamasa):* Cloudflare → Storage & Databases → D1 → **Create** (nom: `ilmiy-yuksalish`), keyin berilgan `database_id` ni `wrangler.jsonc` dagi `d1_databases` elementiga qo'shing: `"database_id": "…"`.

**2. GitHub'dan ulash:** Cloudflare Dashboard → **Workers & Pages → Create → Import a repository** → shu repozitoriyni tanlang.
* Branch: `main` (yoki kerakli branch) · Build command: bo'sh qoldiring · Deploy command: `npx wrangler deploy`
* Har `git push` dan keyin avtomatik qayta joylanadi.

**3. Maxfiy sozlamalar** — Worker → **Settings → Variables and Secrets** (*runtime*, «Build variables» emas!) da **Secret** sifatida qo'shing:

| Nom | Majburiy | Izoh |
|---|---|---|
| `ADMIN_LOGIN` | ha | Admin logini (faqat sizda) |
| `ADMIN_PASSWORD` | ha | Admin paroli — uzun va noyob tanlang. Secret berilmasa admin hisobi yaratilmaydi |
| `GEMINI_API_KEY` | yo'q | **Google Gemini API kaliti** ([aistudio.google.com/apikey](https://aistudio.google.com/apikey), bepul kvota bor) — AI tahlillari uchun. `GOOGLE_API_KEY`, `API_KEY` yoki `AI_API_KEY` (agar «AIza» bilan boshlansa) ham qabul qilinadi |
| `OPENAI_API_KEY` | yo'q | OpenAI (ChatGPT) kaliti (pullik) |
| `ANTHROPIC_API_KEY` | yo'q | Claude kaliti (ixtiyoriy). Kalit bo'lmasa qoidaga asoslangan zaxira matnlar ishlaydi |
| `AI_MODEL` | yo'q | Standart: Gemini uchun `gemini-3.8-flash` (eskirsa avtomatik `gemini-flash-latest` ga o'tadi), OpenAI uchun `gpt-4o-mini`, Claude uchun `claude-sonnet-5-5` |
| `AI_PROVIDER` | yo'q | `gemini`, `openai` yoki `anthropic` — bir nechta kalit bo'lsa tanlash (aks holda ustuvorlik: Gemini > OpenAI > Claude) |
| `OPENAI_BASE_URL` | yo'q | OpenAI bilan mos boshqa xizmat uchun (standart: `https://api.openai.com/v1`) |
| `FEEDS_AUTO` | yo'q | `0` — avtomatik yuklashni o'chiradi |
| `SCOPUS_FEED_URL` | yo'q | SCImago kvartillar CSV manzili (standart: `scimagojr.com/journalrank.php?out=xls`; `off` — o'chirish) |
| `SCOPUS_DISCONTINUED_URL` | yo'q | OAK'ning «Scopus'dan chiqarilgan jurnallar» `.xlsx` manzili (standart manba o'rnatilgan; `off` — o'chirish) |
| `OAK_FEED_URL` | yo'q | OAK ro'yxati (JSON/CSV) — standart manba yo'q |
| `FEED_TTL_HOURS` | yo'q | Takroriy yuklash oralig'i (standart 168 = haftasiga) |

Parolni almashtirish uchun secret qiymatini o'zgartiring — keyingi so'rovda admin paroli yangilanadi.

**Jurnal ma'lumotlarini avtomatik yangilash:** Cloudflare Cron (har dushanba 03:00 UTC, `wrangler.jsonc → triggers.crons`) ikkita manbani o'zi yuklaydi:
1. **SCImago CSV** — bazadagi jurnallarning kvartili yangilanadi (nom yoki ISSN bo'yicha moslashtiriladi; ISSN avtomatik to'ldiriladi);
2. **OAK'ning «Scopus'dan chiqarilgan jurnallar» Excel ro'yxati** — mos jurnallar `discontinued` deb belgilanadi (SCImago keyingi yuklashda ularni qayta «faol» qilmaydi).

Foydalanuvchilar Refresh bosganda qizil belgi va almashtirish aynan shu o'zgarishlar asosida chiqadi. Admin → Statistika da har bir manbaning oxirgi natijasi ko'rinadi; «Fidlarni hozir sinxronlash» tugmasi darhol ishga tushiradi. Sayt avtomatik yuklashni bloklasa (HTML/403), xato admin panelida ko'rinadi va ma'lumotga tegilmaydi — shunda faylni «Fid / import» orqali qo'lda yuklang.
Avtomatik manzillar sandbox'dan tekshirilmagan (scimagojr.com va oak.uz unda ochilmaydi): format real fayllar uchun mo'ljallangan va sintetik fayllar bilan testlangan. Bu yuklashlar CPU talab qiladi (~15 MB CSV) — Workers Paid tavsiya etiladi.

**AI ni tekshirish:** admin kabineti → Statistika → «🤖 AI ni sinash» — kalit, model va (xato bo'lsa) sababini ko'rsatadi (masalan, 401 — noto'g'ri kalit, 429 — hisobda mablag' yo'q).

**Mahalliy sinash:** `npm run dev:cf` (`.dev.vars.example` ni `.dev.vars` ga nusxalab, ichiga ADMIN_LOGIN/ADMIN_PASSWORD yozing).

**Cloudflare cheklovlari:** parol xeshlash (PBKDF2, 100 000 iteratsiya) va katta fid importi CPU talab qiladi. Workers **Free** rejasida (10 ms CPU) kirish/import «Exceeded CPU» xatosi bilan to'xtashi mumkin — shunda **Workers Paid** ($5/oy) rejasiga o'ting.
Free rejada bitta so'rovga 50 ta ichki so'rov (D1 chaqiruvi) chegarasi bor; kod bunga moslab yozilgan (batch), lekin birinchi so'rovdagi boshlang'ich yuklash eng og'ir qism.

## Mahalliy ishga tushirish (Node)

Faqat Node.js ≥ 22.5 kerak (SQLite — `node:sqlite`; Cloudflare uchun `npm install` wrangler'ni o'rnatadi).

```bash
export ADMIN_LOGIN=siz_tanlagan_login
export ADMIN_PASSWORD='kuchli-parol'      # faqat sizda bo'ladi
export GEMINI_API_KEY=AIza...             # ixtiyoriy: AI uchun (Google Gemini); yoki OPENAI_API_KEY / ANTHROPIC_API_KEY
npm start                                 # http://localhost:3000
npm test
```

`ADMIN_PASSWORD` berilmasa, birinchi ishga tushirishda tasodifiy parol yaratilib **bir marta** konsolga chiqariladi.
Admin hisobini ro'yxatdan o'tish orqali yaratib bo'lmaydi — u faqat shu muhit o'zgaruvchilaridan olinadi.

| O'zgaruvchi | Vazifasi |
|---|---|
| `ADMIN_LOGIN`, `ADMIN_PASSWORD` | Admin kabineti hisobi |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, `AI_MODEL` | AI: jurnal moslik tahlili, motivatsiya xabari, reja maslahati, jurnal bo'yicha maslahat, OAK ro'yxatini matndan ajratish |
| `SCOPUS_FEED_URL` | SCImago/Scopus kvartillari CSV yoki JSON manzili |
| `OAK_FEED_URL` | OAK ro'yxati (JSON/CSV) manzili |
| `DATA_DIR`, `PORT` | Mahalliy rejimda ma'lumotlar papkasi va port |

## Imkoniyatlar

**Tadqiqotchi kabineti:** profil (maqom, daraja, yo'nalish, mavzu, muddat) → bosh sahifada iqtibos + AI motivatsiya xabari
va bajarilish foizi; **Trayektoriya** (OAK talablari asosida oyma-oy reja: yengil topshiriqlar — tezis/milliy maqola —
oldinga, uzoq ko'rib chiqiladigan Scopus maqolalari o'rtaga, qo'llanma/monografiya, hujjatlar va himoya — oxirga);
**Hujjatlar** (joriy etish dalolatnomalari, tajriba-sinov ma'lumotnomalari, antiplagiat va h.k., yo'nalishga xos maslahatlar);
**Scopus / OAK / Impakt faktor / Konferensiyalar** — har biri Bepul va Pullik, har bir yo'nalish uchun 10 tagacha tavsiya:
kvartil, boshlangan yil, rasmiy sayt, indekslanganlik isboti havolasi, AI moslik tahlili.

**Til: O'zbekcha / Русский.** Sarlavhadagi «🇷🇺 Русский» tugmasi tilni almashtiradi (tanlov cookie'da saqlanadi). Rus tilida to'liq tarjima qilinadi: interfeys, server xabarlari, OAK ma'lumotnomasi, jurnal qo'llanmalari, hujjatlar/talablar/yo'nalishlar, iqtiboslar, kalendar (.ics) va **AI javoblari** (motivatsiya, moslik tahlili, qoralamalar, g'oyalar rus tilida yoziladi; ruscha mavzu kalit so'zlari jurnal tavsiyasida ham tanib olinadi). Admin paneli faqat o'zbekcha.
Qanday ishlaydi: matnlar o'zbekcha yoziladi, `public/i18n.js` tarjimoni lug'at (`tools/ru-*.txt`) bo'yicha brauzerda `h()` qatlamida va serverda JSON javoblarida tarjima qiladi; `{0}` o'rinbosarli kalitlar dinamik matnlar uchun andoza. Yangi matn qo'shsangiz: `npm run i18n:missing` (tarjimasiz matnlar ro'yxati) → `tools/ru-*.txt` ga qo'shing → `npm run i18n` (public/i18n-ru-*.js ni qayta yaratadi). `test/i18n.test.js` rus rejimida barcha API javoblarida o'zbekcha matn qolmaganini tekshiradi.

**Dissertatsiya ustaxonasi:** (1) *Boblar* — bob-bob rejasi va yozilgan varaqlar hisobi, OAK chegarasi bilan solishtirish (PhD 60, DSc 100 varaq; ijtimoiy-gumanitarda +30%); (2) *Kirish bandlari* — OAK nizomidagi barcha majburiy bandlar (dolzarblik, maqsad, vazifalar, obyekt, predmet, ilmiy yangilik, aprobatsiya…) uchun ko'rsatma, matn maydoni va «✨ Qoralama olish» (AI ulangan bo'lsa mavzuga moslashtirilgan qoralama, aks holda shablon; raqam va manbalar to'qilmaydi); (3) *Maqola g'oyalari* — OAK talab qilgan ishlar soniga (PhD: 7 ta) mos, boblarga tayangan maqola/tezis mavzulari, bir bosishda «Nashrlarim»ga qo'shiladi.

**Reja va haqiqat grafigi** (bosh sahifa): har oy oxirigacha bajarilishi kerak bo'lgan ulush bilan haqiqiy bajarilish taqqoslanadi. **Kalendarga eksport:** Trayektoriya → «📅 Kalendarga (.ics)» — bajarilmagan vazifalar oy oxiri muddati va 5 kunlik eslatma bilan Google/Apple/Outlook kalendariga qo'shiladi. Sayt telefonga «ilova» sifatida o'rnatiladi (PWA manifest).

**Jurnal ishonchlilik tekshiruvi:** jurnal oynasidagi 10 bandli ro'yxat (Think. Check. Submit. tamoyillari: ISSN, indekslanish, APC ochiqligi, tahrir hay'ati, soxta ko'rsatkichlar…) xavf darajasini ko'rsatadi.

**Nashrlarim:** tadqiqotchi o'z maqola va tezislarini kiritib, holatini kuzatadi (tayyorlanmoqda → yuborildi → ko'rib chiqilmoqda → revision → qabul → chop etildi / rad etildi), jurnalni katalogdan tanlaydi, DOI/havola va hammualliflarni saqlaydi. OAK minimal talablari bo'yicha **real** hisob ko'rsatiladi (masalan, «Chop etilgan ishlar: 3 / 7»); «Chop etildi» holatida trayektoriyadagi mos vazifa avtomatik belgilanadi (holat qaytarilsa yoki nashr o'chirilsa — belgi olinadi). Jurnalning odatdagi muddatidan 1,5 baravar uzoq kutilayotgan maqolalar uchun bosh sahifada eslatma chiqadi.

**Katalog:** barcha jurnallar bo'yicha qidiruv (nom, nashriyot, mavzu, ISSN) va filtrlar (Scopus / OAK / impakt / arzon / konferensiya, bepul-pullik, kvartil); jurnal ustiga bosilsa batafsil oyna ochiladi.

**Hisob:** foydalanuvchi parolini o'zgartira oladi (🔑); admin foydalanuvchi parolini tiklaydi (eski sessiyalar tugatiladi). Trayektoriyani «🖨 Chop etish / PDF» tugmasi bilan chop etish mumkin.

**Jurnal batafsil oynasi:** istalgan tavsiya etilgan jurnal (yoki konferensiya) ustiga bosilganda: to'liq ma'lumot va indeks isboti havolalari, maqolani tayyorlash/rasmiylashtirish tavsiyalari (OAK, Scopus/WoS, arzon nashrlar uchun alohida bo'limlar) va yuborishning bosqichma-bosqich yo'riqnomasi (14 bosqich: indeksni tekshirish → yuborish tizimi → peer review → revision → to'lov → chop etish → nashrdan keyingi hujjatlar). AI kaliti bo'lsa, foydalanuvchi mavzusiga moslashtirilgan AI maslahat ham olish mumkin.

**Arzon impakt (Scopus'siz):** Scopus'da indekslanmagan, Web of Science (ESCI/JCR) yoki muqobil IF manbasi bor, bepul yoki nashr to'lovi ≤ 600 USD bo'lgan nashrlar. OAK muqobil «impakt faktor» xizmatlarini (SJIF, GIF va h.k.) tan olmaydi — bunday jurnallar qizil belgi va ogohlantirish bilan ko'rsatiladi.

**Refresh:** kvartili pasaygan, Scopus yoki OAK ro'yxatidan chiqqan jurnal **o'chirilmaydi** — qizil bilan belgilanadi,
o'rniga yangi jurnal tavsiya etiladi (faol tavsiyalar yana 10 ta). Kvartili ko'tarilganlar yashil belgilanadi.

**Admin kabineti:** statistika va yo'nalishlar bo'yicha qamrov jadvali, foydalanuvchilar, jurnallar / yo'nalishlar /
OAK talablari / hujjat shablonlari / iqtiboslar CRUD, fid import (SCImago CSV, OAK ro'yxati, AI yordamida matndan
ajratish), jurnallardagi o'zgarishlar tarixi.

## OAK ma'lumotnomasi (rasmiy manba asosida)

`src/data/oak_reference.md` — oak.uz va lex.uz dan yig'ilgan ma'lumotnoma (2026-yil 11-oktabr holati). Undan olingan:

* **PhD / DSc minimal talablari** (`requirements` jadvali, `verified=1`): PhD — jami 7 ta ish: 3 ta maqola (1 tasi xorijiy) + 2 ta xalqaro konferensiya materiali + 2 ta qo'shimcha; DSc — jami 15 ta, 10 ta maqola (1 xorijiy), 2 ta konferensiya.
* **PF-98 (26.05.2026)**: 2027-yil 1-yanvardan bekor bo'ladigan tartiblar (`doc_templates.cancelled_from`). Trayektoriya muddati 2027-yilgacha tugasa — eski tartib, keyin tugasa — bekor qilinadigan vazifalar «ixtiyoriy / 2027 dan bekor» deb belgilanadi.
* **10.06.2026 qoidasi**: A/B/C bazalar, tan olinmaydigan indekslar, DOI/ResearchGate yetarli emasligi — «OAK ma'lumotnomasi» sahifasida.
* **08.00.00 Iqtisodiyot** bo'yicha OAK ro'yxatidagi 180 ta jurnal (milliy, MDH, xorijiy) — OAK bo'limiga yuklangan; 08.00.01–08.00.19 (jumladan **08.00.17 Turizm va mehmonxona faoliyati**) va 11.00.xx ixtisosliklari.

## ⚠️ Ma'lumotlar haqida eslatma

* `tekshirilmagan` deb belgilangan yozuvlar (asosan Scopus kvartillari, to'lov shartlari, pedagogika va boshqa sohalardagi milliy jurnallar) namuna: scopus.com, scimagojr.com va oak.uz (https://oak.uz/pages/31738) bilan solishtirib tasdiqlang yoki «Fid / import» orqali yangilang.
* OAK ro'yxatidagi jurnallar uchun to'lov shartlari (bepul/pullik) ma'lumotnomada yo'q — hammasi «bepul» deb qo'yilgan; jurnal saytida tekshiring.
* Pedagogika (13.00.00, 135 ta jurnal), tibbiyot, texnika va boshqa sohalarning OAK ro'yxati hali yuklanmagan — oak.uz reyestridan CSV/JSON qilib import qiling.
* Admin panelidagi «Qamrov» jadvali har bir yo'nalish/toifada nechta nomzod borligini ko'rsatadi (qizil = 10 tadan kam).
* oak.uz va Scopus bilan jonli integratsiya sinab ko'rilmagan (sandbox'dan oak.uz ochilmadi); u fid formatlari orqali qurilgan va testlangan.

## Qo'shimcha imkoniyatlar
- ☆ Saqlangan jurnallar (izoh bilan) va 4 tagacha jurnalni yonma-yon taqqoslash (`#/saved`).
- Ilmiy ishlar ro'yxati (nusxalash, .txt, CSV) va dissertatsiya kirish matnini .txt sifatida yuklash.
- Yorug'/qorong'i/avto mavzu almashtirgich, mobil menyu.
- Admin: tahlil paneli (`/api/admin/analytics`) va jurnallar CSV eksporti (`/api/admin/export/journals.csv`).

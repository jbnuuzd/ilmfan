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
| `ANTHROPIC_API_KEY` | yo'q | AI tahlillari uchun; bo'lmasa qoidaga asoslangan zaxira matnlar ishlaydi |
| `AI_MODEL` | yo'q | Standart: `claude-sonnet-5-5` |
| `SCOPUS_FEED_URL`, `OAK_FEED_URL` | yo'q | Jurnal fidlari (CSV/JSON), Refresh paytida 6 soatda bir marta olinadi |

Parolni almashtirish uchun secret qiymatini o'zgartiring — keyingi so'rovda admin paroli yangilanadi.

**Mahalliy sinash:** `npm run dev:cf` (`.dev.vars.example` ni `.dev.vars` ga nusxalab, ichiga ADMIN_LOGIN/ADMIN_PASSWORD yozing).

**Cloudflare cheklovlari:** parol xeshlash (PBKDF2, 100 000 iteratsiya) va katta fid importi CPU talab qiladi. Workers **Free** rejasida (10 ms CPU) kirish/import «Exceeded CPU» xatosi bilan to'xtashi mumkin — shunda **Workers Paid** ($5/oy) rejasiga o'ting.
Free rejada bitta so'rovga 50 ta ichki so'rov (D1 chaqiruvi) chegarasi bor; kod bunga moslab yozilgan (batch), lekin birinchi so'rovdagi boshlang'ich yuklash eng og'ir qism.

## Mahalliy ishga tushirish (Node)

Faqat Node.js ≥ 22.5 kerak (SQLite — `node:sqlite`; Cloudflare uchun `npm install` wrangler'ni o'rnatadi).

```bash
export ADMIN_LOGIN=siz_tanlagan_login
export ADMIN_PASSWORD='kuchli-parol'      # faqat sizda bo'ladi
export ANTHROPIC_API_KEY=sk-ant-...       # ixtiyoriy: AI tahlillari uchun
npm start                                 # http://localhost:3000
npm test
```

`ADMIN_PASSWORD` berilmasa, birinchi ishga tushirishda tasodifiy parol yaratilib **bir marta** konsolga chiqariladi.
Admin hisobini ro'yxatdan o'tish orqali yaratib bo'lmaydi — u faqat shu muhit o'zgaruvchilaridan olinadi.

| O'zgaruvchi | Vazifasi |
|---|---|
| `ADMIN_LOGIN`, `ADMIN_PASSWORD` | Admin kabineti hisobi |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | AI: jurnal moslik tahlili, motivatsiya xabari, reja maslahati, OAK ro'yxatini matndan ajratish |
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

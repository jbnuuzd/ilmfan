'use strict';
/*
 * BOSHLANG'ICH (NAMUNA) MA'LUMOTLAR.
 * Diqqat: bu yerdagi jurnal kvartillari, to'lov shartlari, OAK ro'yxati holati va OAK minimal
 * talablari `verified = 0` (tekshirilmagan) deb belgilangan. Ular rasmiy manbalar
 * (scopus.com, scimagojr.com, oak.uz, lex.uz) bilan solishtirilib, admin kabinetida
 * tasdiqlanishi yoki fidlar orqali yangilanishi kerak.
 */

const T = (code, name, field_group, tags, hints = '') => ({ code, name, field_group, tags, hints });

const PED_HINTS = [
  "Tajriba-sinov ishlari o'tkazilgan ta'lim muassasalaridan natijalar to'g'risida ma'lumotnoma (kollej / maktab / OTM)",
  "Tadqiqot natijalarini o'quv jarayoniga joriy etish dalolatnomasi (kamida 2-3 ta muassasadan)",
  "Tajriba-sinov ishlari dasturi, bayonnomalari va statistik (matematik) tahlil natijalari",
  "Ishlab chiqilgan metodika/modul/o'quv-metodik majmuaning tasdiqlangan nusxasi (kengash/metod kengash bayonnomasi)",
  "So'rovnoma va test materiallari, respondentlar soni va ishonchlilik ko'rsatkichlari",
  "Ilmiy rahbar fikri va kafedra (laboratoriya) yig'ilishi xulosasi",
];

const ECON_HINTS = "Statistika qo'mitasi/vazirlik ma'lumotlari manbalari ma'lumotnomasi|Takliflarni joriy etish dalolatnomasi (korxona, vazirlik, hokimlik) — 2027-yildan majburiy emas, lekin natija ahamiyatini asoslaydi|Ekonometrik model hisob-kitoblari ilovasi|Asosiy ilmiy maqolalar yakka mualliflikda bo'lishi shart (ijtimoiy-gumanitar soha)";

const directions = [
  T('13.00.01', "Pedagogika nazariyasi va tarixi. Ta'lim falsafasi", 'Pedagogika', 'education,pedagogy,highered', PED_HINTS.join('|')),
  T('13.00.02', "Ta'lim va tarbiya nazariyasi va metodikasi (fanlar bo'yicha)", 'Pedagogika', 'education,pedagogy,edtech', PED_HINTS.join('|')),
  T('13.00.03', "Maxsus pedagogika (inklyuziv ta'lim)", 'Pedagogika', 'education,pedagogy,inclusive', PED_HINTS.join('|')),
  T('13.00.05', "Kasb-hunar ta'limi nazariyasi va metodikasi", 'Pedagogika', 'education,vocational,pedagogy,edtech', PED_HINTS.concat(["Ish beruvchi korxonalardan (ishlab chiqarish amaliyoti, dual ta'lim) tavsiyanoma va hamkorlik shartnomalari", "Kasbiy kompetensiyalar bo'yicha baholash mezonlari va bitiruvchilar bandligi statistikasi"]).join('|')),
  T('13.00.08', "Uzluksiz ta'lim, raqamli ta'lim va ta'lim texnologiyalari", 'Pedagogika', 'education,edtech,highered', PED_HINTS.join('|')),
  T('05.13.00', "Informatika, hisoblash texnikasi va boshqaruv", 'Texnika / IT', 'cs,engineering', "Dasturiy mahsulotga DGU (Intellektual mulk agentligi) guvohnomasi|Dasturni amaliyotga joriy etish dalolatnomasi|Dastur kodi va sinov natijalari ilovasi"),
  T('05.01.00', "Muhandislik, texnologiya va materialshunoslik", 'Texnika / IT', 'engineering,energy,materials', "Foydali modelga/ixtiroga patent|Sinov laboratoriyasi bayonnomasi|Ishlab chiqarishga joriy etish dalolatnomasi va iqtisodiy samara hisobi"),
  ...[
    ['08.00.01', 'Iqtisodiyot nazariyasi', 'economics'], ['08.00.02', 'Makroiqtisodiyot', 'economics,finance'], ['08.00.03', 'Sanoat iqtisodiyoti', 'economics,management'],
    ['08.00.04', "Qishloq xo'jaligi iqtisodiyoti", 'economics,agri'], ['08.00.05', "Xizmat ko'rsatish tarmoqlari iqtisodiyoti", 'economics,management,tourism'], ['08.00.06', 'Ekonometrika va statistika', 'economics,finance'],
    ['08.00.07', 'Moliya, pul muomalasi va kredit', 'finance,economics'], ['08.00.08', 'Buxgalteriya hisobi, iqtisodiy tahlil va audit', 'finance,economics,management'], ['08.00.09', 'Jahon iqtisodiyoti', 'economics,finance'],
    ['08.00.10', 'Demografiya. Mehnat iqtisodiyoti', 'economics,social'], ['08.00.11', 'Marketing', 'management,economics,tourism'], ['08.00.12', 'Mintaqaviy iqtisodiyot', 'economics,tourism'],
    ['08.00.13', 'Menejment', 'management,economics'], ['08.00.14', 'Iqtisodiyotda axborot tizimlari va texnologiyalari', 'economics,cs,management'], ['08.00.15', 'Tadbirkorlik va kichik biznes iqtisodiyoti', 'economics,management'],
    ['08.00.16', 'Raqamli iqtisodiyot va xalqaro raqamli integratsiya', 'economics,cs,management'], ['08.00.17', 'Turizm va mehmonxona faoliyati', 'tourism,economics,management'], ['08.00.18', "Kambag'allik va taraqqiyot", 'economics,social'],
    ['08.00.19', "Davlat boshqaruvining iqtisodiy asoslari", 'economics,management,social'],
  ].map(([c, n, tags]) => T(c, n, 'Iqtisodiyot', tags, ECON_HINTS)),
  ...[
    ['11.00.01', 'Tabiiy geografiya', 'geography,natural'], ['11.00.02', 'Iqtisodiy va ijtimoiy geografiya', 'geography,economics,tourism'], ['11.00.03', 'Quruqlik gidrologiyasi', 'geography,natural'],
    ['11.00.04', 'Meteorologiya', 'geography,natural'], ['11.00.05', 'Atrof-muhitni muhofaza qilish', 'geography,natural'], ['11.00.06', 'Geodeziya. Kartografiya', 'geography,engineering'], ['11.00.07', 'Geoinformatika', 'geography,cs'],
  ].map(([c, n, tags]) => T(c, n, 'Geografiya', tags, '')),
  T('14.00.00', "Tibbiyot va sog'liqni saqlash", 'Tibbiyot', 'medicine,publichealth', "Axloq qo'mitasi xulosasi|Klinik bazadan ma'lumotnoma va joriy etish dalolatnomasi|Statistik tahlil bayonnomasi"),
  T('03.00.00', "Biologiya, kimyo, qishloq xo'jaligi va tabiiy fanlar", 'Tabiiy fanlar', 'natural,agri,chemistry,engineering', "Tajriba dalalari/laboratoriya ma'lumotnomalari|Joriy etish dalolatnomasi (fermer xo'jaligi, korxona)|Natijalar statistik tahlili"),
  T('10.00.00', "Filologiya, tilshunoslik va adabiyotshunoslik", 'Gumanitar', 'humanities,linguistics,education', "Korpus/material manbalari ro'yxati|Metodikani o'quv jarayoniga joriy etish dalolatnomasi"),
  T('12.00.00', "Yurisprudensiya", 'Gumanitar', 'law,social', "Takliflarni qonunchilikka/amaliyotga joriy etish to'g'risida ma'lumotnoma|Sud-huquqiy amaliyot tahlili ilovasi"),
];

// [name, publisher, country, since, access, apc, scopus, Q, oak, IF, wos, subjects, accept, weeks, url, desc]
const J = (o) => Object.assign({ kind: 'journal', issn: '', apc_usd: null, impact_factor: null, wos: 0, scopus_status: 'none', quartile: '', oak_status: 'none', acceptance: 3, review_weeks: null, official_url: '', scopus_url: '', oak_url: '', description: '', since_year: null, verified: 0 }, o);
const sc = (name) => `https://www.scimagojr.com/journalsearch.php?q=${encodeURIComponent(name)}`;
const S = (name, publisher, country, since, access, q, subjects, extra = {}) =>
  J({ name, publisher, country, since_year: since, access, scopus_status: 'active', quartile: q, subjects, scopus_url: sc(name), ...extra });

const journals = [
  // ---------- Ta'lim: Scopus (bepul = mualliflardan to'lov talab qilinmaydigan) ----------
  S('Computers & Education', 'Elsevier', 'Birlashgan Qirollik', 1976, 'free', 'Q1', 'education,edtech,highered', { impact_factor: 10.5, wos: 1, acceptance: 2, review_weeks: 16, official_url: 'https://www.sciencedirect.com/journal/computers-and-education', description: "Ta'limda axborot texnologiyalari bo'yicha yetakchi jurnal. Qabul darajasi past, lekin nufuzi juda yuqori." }),
  S('Educational Research Review', 'Elsevier', 'Niderlandiya', 2006, 'free', 'Q1', 'education,pedagogy', { impact_factor: 9.6, wos: 1, acceptance: 2, review_weeks: 14, official_url: 'https://www.sciencedirect.com/journal/educational-research-review' }),
  S('Teaching and Teacher Education', 'Elsevier', 'Birlashgan Qirollik', 1985, 'free', 'Q1', 'education,pedagogy,highered', { impact_factor: 4.7, wos: 1, acceptance: 2, review_weeks: 14, official_url: 'https://www.sciencedirect.com/journal/teaching-and-teacher-education' }),
  S('Journal of Vocational Education & Training', 'Routledge (Taylor & Francis)', 'Birlashgan Qirollik', 1949, 'free', 'Q1', 'vocational,education', { impact_factor: 2.6, wos: 1, acceptance: 3, review_weeks: 12, official_url: 'https://www.tandfonline.com/journals/rjve20', description: "Kasb-hunar ta'limi bo'yicha eng mos jurnallardan biri." }),
  S('Vocations and Learning', 'Springer', 'Germaniya', 2008, 'free', 'Q1', 'vocational,education', { impact_factor: 3.0, wos: 1, acceptance: 3, review_weeks: 12, official_url: 'https://link.springer.com/journal/12186' }),
  S('Journal of Education and Work', 'Routledge (Taylor & Francis)', 'Birlashgan Qirollik', 1987, 'free', 'Q2', 'vocational,education', { impact_factor: 2.0, wos: 1, acceptance: 3, review_weeks: 12, official_url: 'https://www.tandfonline.com/journals/cjew20' }),
  S('International Journal of Training and Development', 'Wiley', 'Birlashgan Qirollik', 1997, 'free', 'Q2', 'vocational,education,management', { impact_factor: 2.4, wos: 1, acceptance: 3, review_weeks: 12 }),
  S('Education + Training', 'Emerald', 'Birlashgan Qirollik', 1959, 'free', 'Q2', 'vocational,education,management', { acceptance: 4, review_weeks: 10 }),
  S('Higher Education Research & Development', 'Routledge (Taylor & Francis)', 'Birlashgan Qirollik', 1982, 'free', 'Q1', 'highered,education', { impact_factor: 3.3, wos: 1, acceptance: 3, review_weeks: 12 }),
  S('Educational Technology & Society', 'IFETS', 'Tayvan', 1998, 'free', 'Q1', 'edtech,education', { impact_factor: 3.0, wos: 1, acceptance: 3, review_weeks: 14, description: "Diamond open access: mualliflar ham, o'quvchilar ham to'lamaydi." }),
  S('Australasian Journal of Educational Technology', 'ASCILITE', 'Avstraliya', 1985, 'free', 'Q1', 'edtech,education,highered', { impact_factor: 4.0, wos: 1, acceptance: 3, review_weeks: 14 }),
  S('International Review of Research in Open and Distributed Learning', 'Athabasca University', 'Kanada', 2000, 'free', 'Q1', 'edtech,education,highered', { wos: 1, acceptance: 3, review_weeks: 14, description: "Masofaviy va ochiq ta'lim bo'yicha bepul OA jurnal." }),
  S('Journal of Technical Education and Training', 'UTHM', 'Malayziya', 2009, 'free', 'Q3', 'vocational,education,engineering', { acceptance: 5, review_weeks: 8, description: "Texnik va kasb ta'limiga ixtisoslashgan, qabul ehtimoli nisbatan yuqori." }),
  S('International Journal of Instruction', 'Gate Association for Teaching and Education', "Turkiya", 2008, 'free', 'Q2', 'education,pedagogy', { acceptance: 4, review_weeks: 8 }),
  S('European Journal of Educational Research', 'Eurasian Society of Educational Research', "Turkiya", 2012, 'free', 'Q3', 'education,pedagogy,edtech', { acceptance: 5, review_weeks: 6 }),
  S('Cypriot Journal of Educational Sciences', 'Birlik University', 'Kipr', 2006, 'free', 'Q3', 'education,pedagogy', { acceptance: 5, review_weeks: 6 }),
  S('Turkish Online Journal of Distance Education', 'Anadolu University', "Turkiya", 2000, 'free', 'Q2', 'edtech,education,highered', { acceptance: 4, review_weeks: 8 }),
  // Ta'lim: Scopus pullik
  S('Education Sciences', 'MDPI', 'Shveytsariya', 2011, 'paid', 'Q2', 'education,pedagogy,edtech,vocational', { apc_usd: 1800, wos: 1, impact_factor: 2.5, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/education' }),
  S('Sustainability', 'MDPI', 'Shveytsariya', 2009, 'paid', 'Q1', 'education,tourism,economics,engineering,energy,natural,management', { apc_usd: 2400, wos: 1, impact_factor: 3.9, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/sustainability' }),
  S('Cogent Education', 'Taylor & Francis', 'Birlashgan Qirollik', 2014, 'paid', 'Q2', 'education,pedagogy,highered', { apc_usd: 1250, wos: 1, acceptance: 4, review_weeks: 8, official_url: 'https://www.tandfonline.com/journals/oaed20' }),
  S('Empirical Research in Vocational Education and Training', 'SpringerOpen', 'Shveytsariya', 2009, 'paid', 'Q2', 'vocational,education', { apc_usd: 1900, acceptance: 3, review_weeks: 10, official_url: 'https://ervet-journal.springeropen.com' }),
  S('SAGE Open', 'SAGE', 'AQSh', 2011, 'paid', 'Q2', 'education,tourism,humanities,social,management', { apc_usd: 1500, wos: 1, acceptance: 4, review_weeks: 8, official_url: 'https://journals.sagepub.com/home/sgo' }),
  S('Heliyon', 'Cell Press (Elsevier)', 'Birlashgan Qirollik', 2015, 'paid', 'Q1', 'education,natural,medicine,engineering,cs,social', { apc_usd: 2500, wos: 1, acceptance: 4, review_weeks: 8, official_url: 'https://www.cell.com/heliyon' }),
  S('Universal Journal of Educational Research', 'Horizon Research Publishing', 'AQSh', 2013, 'paid', 'Q3', 'education,pedagogy', { apc_usd: 500, acceptance: 5, review_weeks: 4 }),
  S('TEM Journal', 'UIKTEN', 'Serbiya', 2012, 'paid', 'Q3', 'edtech,education,cs,management,engineering', { apc_usd: 400, acceptance: 5, review_weeks: 4 }),

  // ---------- Kompyuter fanlari ----------
  S('Expert Systems with Applications', 'Elsevier', 'Birlashgan Qirollik', 1990, 'free', 'Q1', 'cs,engineering,management', { impact_factor: 7.5, wos: 1, acceptance: 2, review_weeks: 16, official_url: 'https://www.sciencedirect.com/journal/expert-systems-with-applications' }),
  S('Knowledge-Based Systems', 'Elsevier', 'Niderlandiya', 1987, 'free', 'Q1', 'cs', { impact_factor: 7.2, wos: 1, acceptance: 2, review_weeks: 16, official_url: 'https://www.sciencedirect.com/journal/knowledge-based-systems' }),
  S('Information Sciences', 'Elsevier', 'Niderlandiya', 1968, 'free', 'Q1', 'cs', { impact_factor: 8.1, wos: 1, acceptance: 2, review_weeks: 16, official_url: 'https://www.sciencedirect.com/journal/information-sciences' }),
  S('Journal of King Saud University - Computer and Information Sciences', 'Elsevier', 'Saudiya Arabistoni', 1989, 'free', 'Q1', 'cs,edtech', { wos: 1, acceptance: 3, review_weeks: 12 }),
  S('Computer Applications in Engineering Education', 'Wiley', 'AQSh', 1993, 'free', 'Q1', 'cs,edtech,engineering,education', { wos: 1, acceptance: 3, review_weeks: 12 }),
  S('IEEE Access', 'IEEE', 'AQSh', 2013, 'paid', 'Q2', 'cs,engineering,energy', { apc_usd: 1995, wos: 1, impact_factor: 3.9, acceptance: 4, review_weeks: 6, official_url: 'https://ieeeaccess.ieee.org' }),
  S('Applied Sciences', 'MDPI', 'Shveytsariya', 2011, 'paid', 'Q2', 'cs,engineering,materials,natural,energy', { apc_usd: 2400, wos: 1, impact_factor: 2.5, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/applsci' }),
  S('Sensors', 'MDPI', 'Shveytsariya', 2001, 'paid', 'Q2', 'cs,engineering', { apc_usd: 2600, wos: 1, impact_factor: 3.4, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/sensors' }),
  S('Electronics', 'MDPI', 'Shveytsariya', 2012, 'paid', 'Q2', 'cs,engineering', { apc_usd: 2100, wos: 1, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/electronics' }),
  S('Information', 'MDPI', 'Shveytsariya', 2010, 'paid', 'Q2', 'cs,edtech', { apc_usd: 1800, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/information' }),
  S('PeerJ Computer Science', 'PeerJ', 'AQSh', 2015, 'paid', 'Q1', 'cs', { apc_usd: 1500, wos: 1, acceptance: 3, review_weeks: 8, official_url: 'https://peerj.com/computer-science/' }),
  S('Journal of Big Data', 'SpringerOpen', 'Birlashgan Qirollik', 2014, 'paid', 'Q1', 'cs', { apc_usd: 2600, wos: 1, acceptance: 3, review_weeks: 10 }),

  // ---------- Iqtisodiyot ----------
  S('Economic Modelling', 'Elsevier', 'Niderlandiya', 1983, 'free', 'Q1', 'economics,finance', { impact_factor: 4.7, wos: 1, acceptance: 2, review_weeks: 16 }),
  S('Research in International Business and Finance', 'Elsevier', 'Niderlandiya', 1986, 'free', 'Q1', 'economics,finance,management', { wos: 1, acceptance: 3, review_weeks: 14 }),
  S('Emerging Markets Finance and Trade', 'Routledge (Taylor & Francis)', 'AQSh', 1965, 'free', 'Q2', 'economics,finance', { wos: 1, acceptance: 3, review_weeks: 12 }),
  S('Post-Communist Economies', 'Routledge (Taylor & Francis)', 'Birlashgan Qirollik', 1989, 'free', 'Q2', 'economics,social', { wos: 1, acceptance: 4, review_weeks: 10, description: "Postsovet mamlakatlar iqtisodiyotiga ixtisoslashgan — O'zbekiston mavzulari uchun mos." }),
  S('Economies', 'MDPI', 'Shveytsariya', 2013, 'paid', 'Q2', 'economics,tourism,finance,management', { apc_usd: 1800, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/economies' }),
  S('Journal of Risk and Financial Management', 'MDPI', 'Shveytsariya', 2008, 'paid', 'Q2', 'finance,economics', { apc_usd: 1800, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/jrfm' }),
  S('Cogent Economics & Finance', 'Taylor & Francis', 'Birlashgan Qirollik', 2013, 'paid', 'Q2', 'economics,tourism,finance,management', { apc_usd: 1250, acceptance: 4, review_weeks: 8 }),
  S('Economic Research-Ekonomska Istrazivanja', 'Taylor & Francis (Open)', 'Xorvatiya', 1988, 'paid', 'Q1', 'economics,management', { apc_usd: 1400, wos: 1, acceptance: 3, review_weeks: 10 }),
  S('Problems and Perspectives in Management', 'LLC CPC Business Perspectives', 'Ukraina', 2003, 'paid', 'Q3', 'management,economics', { apc_usd: 700, acceptance: 5, review_weeks: 6 }),
  S('Montenegrin Journal of Economics', 'Ekonomska Misao', 'Chernogoriya', 2005, 'free', 'Q3', 'economics,finance,management', { acceptance: 5, review_weeks: 8 }),

  // ---------- Muhandislik / tabiiy fanlar ----------
  S('Journal of Cleaner Production', 'Elsevier', 'Niderlandiya', 1993, 'free', 'Q1', 'engineering,energy,natural,management', { impact_factor: 9.8, wos: 1, acceptance: 2, review_weeks: 16 }),
  S('Energy', 'Elsevier', 'Birlashgan Qirollik', 1976, 'free', 'Q1', 'energy,engineering', { impact_factor: 9.0, wos: 1, acceptance: 2, review_weeks: 14 }),
  S('Renewable Energy', 'Elsevier', 'Birlashgan Qirollik', 1991, 'free', 'Q1', 'energy,engineering', { impact_factor: 9.0, wos: 1, acceptance: 2, review_weeks: 14 }),
  S('Energies', 'MDPI', 'Shveytsariya', 2008, 'paid', 'Q2', 'energy,engineering', { apc_usd: 2400, wos: 1, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/energies' }),
  S('Materials', 'MDPI', 'Shveytsariya', 2008, 'paid', 'Q2', 'materials,engineering,chemistry', { apc_usd: 2600, wos: 1, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/materials' }),
  S('Scientific Reports', 'Nature Portfolio', 'Birlashgan Qirollik', 2011, 'paid', 'Q1', 'natural,medicine,engineering,chemistry,agri', { apc_usd: 2400, wos: 1, impact_factor: 3.8, acceptance: 3, review_weeks: 12, official_url: 'https://www.nature.com/srep/' }),
  S('PLOS ONE', 'PLOS', 'AQSh', 2006, 'paid', 'Q1', 'natural,medicine,social,agri,chemistry', { apc_usd: 1900, wos: 1, impact_factor: 2.9, acceptance: 4, review_weeks: 10, official_url: 'https://journals.plos.org/plosone/' }),
  S('Agronomy', 'MDPI', 'Shveytsariya', 2011, 'paid', 'Q1', 'agri,natural', { apc_usd: 2200, wos: 1, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/agronomy' }),
  S('Molecules', 'MDPI', 'Shveytsariya', 1996, 'paid', 'Q1', 'chemistry,natural', { apc_usd: 2700, wos: 1, acceptance: 4, review_weeks: 5 }),
  S('Results in Physics', 'Elsevier', 'Niderlandiya', 2011, 'paid', 'Q1', 'natural,materials', { apc_usd: 2000, wos: 1, acceptance: 4, review_weeks: 8 }),

  // ---------- Tibbiyot / gumanitar ----------
  S('BMC Public Health', 'BMC (Springer Nature)', 'Birlashgan Qirollik', 2001, 'paid', 'Q1', 'medicine,publichealth', { apc_usd: 2600, wos: 1, acceptance: 3, review_weeks: 10 }),
  S('International Journal of Environmental Research and Public Health', 'MDPI', 'Shveytsariya', 2004, 'paid', 'Q1', 'medicine,publichealth', { apc_usd: 2500, wos: 1, acceptance: 4, review_weeks: 5 }),
  S('Healthcare', 'MDPI', 'Shveytsariya', 2013, 'paid', 'Q2', 'medicine,publichealth', { apc_usd: 2300, wos: 1, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/healthcare' }),
  S('Journal of Clinical Medicine', 'MDPI', 'Shveytsariya', 2012, 'paid', 'Q1', 'medicine', { apc_usd: 2600, wos: 1, acceptance: 4, review_weeks: 5 }),
  S('Cureus', 'Springer Nature', 'AQSh', 2009, 'paid', 'Q2', 'medicine', { apc_usd: 600, acceptance: 4, review_weeks: 4 }),
  S('BMJ Open', 'BMJ', 'Birlashgan Qirollik', 2011, 'paid', 'Q1', 'medicine,publichealth', { apc_usd: 2500, wos: 1, acceptance: 3, review_weeks: 10 }),
  S('Medicine', 'Wolters Kluwer', 'AQSh', 1922, 'paid', 'Q2', 'medicine', { apc_usd: 1950, acceptance: 4, review_weeks: 6 }),
  S('Frontiers in Medicine', 'Frontiers', 'Shveytsariya', 2014, 'paid', 'Q1', 'medicine', { apc_usd: 3000, wos: 1, acceptance: 3, review_weeks: 10 }),
  S('Languages', 'MDPI', 'Shveytsariya', 2016, 'paid', 'Q1', 'linguistics,humanities,education', { apc_usd: 1800, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/languages' }),
  S('Laws', 'MDPI', 'Shveytsariya', 2012, 'paid', 'Q2', 'law,social', { apc_usd: 1800, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/laws' }),
  S('Social Sciences', 'MDPI', 'Shveytsariya', 2012, 'paid', 'Q2', 'social,humanities,law,education', { apc_usd: 1800, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/socsci' }),

  // ---------- Turizm va mehmonxona faoliyati (08.00.17) ----------
  S('Tourism Management', 'Elsevier', 'Birlashgan Qirollik', 1982, 'free', 'Q1', 'tourism,management,economics', { impact_factor: 12.7, wos: 1, acceptance: 2, review_weeks: 16, official_url: 'https://www.sciencedirect.com/journal/tourism-management' }),
  S('Annals of Tourism Research', 'Elsevier', 'Birlashgan Qirollik', 1973, 'free', 'Q1', 'tourism,social,management', { impact_factor: 9.0, wos: 1, acceptance: 2, review_weeks: 16, official_url: 'https://www.sciencedirect.com/journal/annals-of-tourism-research' }),
  S('Journal of Travel Research', 'SAGE', 'AQSh', 1962, 'free', 'Q1', 'tourism,management,economics', { impact_factor: 10.9, wos: 1, acceptance: 2, review_weeks: 14 }),
  S('Journal of Sustainable Tourism', 'Routledge (Taylor & Francis)', 'Birlashgan Qirollik', 1993, 'free', 'Q1', 'tourism,natural,management', { impact_factor: 9.5, wos: 1, acceptance: 2, review_weeks: 14 }),
  S('Tourism Management Perspectives', 'Elsevier', 'Niderlandiya', 2012, 'free', 'Q1', 'tourism,management', { impact_factor: 9.0, wos: 1, acceptance: 3, review_weeks: 12 }),
  S('Current Issues in Tourism', 'Routledge (Taylor & Francis)', 'Birlashgan Qirollik', 1998, 'free', 'Q1', 'tourism,management,economics', { impact_factor: 5.7, wos: 1, acceptance: 3, review_weeks: 10 }),
  S('Tourism Geographies', 'Routledge (Taylor & Francis)', 'Birlashgan Qirollik', 1999, 'free', 'Q1', 'tourism,geography', { impact_factor: 6.0, wos: 1, acceptance: 3, review_weeks: 12 }),
  S('Tourism Economics', 'SAGE', 'Birlashgan Qirollik', 1995, 'free', 'Q1', 'tourism,economics', { impact_factor: 4.5, wos: 1, acceptance: 3, review_weeks: 12 }),
  S('Asia Pacific Journal of Tourism Research', 'Routledge (Taylor & Francis)', 'Birlashgan Qirollik', 1996, 'free', 'Q1', 'tourism,management', { impact_factor: 3.5, wos: 1, acceptance: 3, review_weeks: 10 }),
  S('Journal of Destination Marketing & Management', 'Elsevier', 'Niderlandiya', 2012, 'free', 'Q1', 'tourism,management', { impact_factor: 8.0, wos: 1, acceptance: 3, review_weeks: 12 }),
  S('International Journal of Hospitality Management', 'Elsevier', 'Birlashgan Qirollik', 1982, 'free', 'Q1', 'tourism,management', { impact_factor: 9.0, wos: 1, acceptance: 2, review_weeks: 14 }),
  S('GeoJournal of Tourism and Geosites', 'Oradea University', 'Ruminiya', 2008, 'free', 'Q2', 'tourism,geography', { acceptance: 4, review_weeks: 8, description: "Turizm va geomeros bo'yicha ochiq (mualliflardan to'lov talab qilinmaydigan) jurnal." }),
  S('Journal of Hospitality and Tourism Management', 'Elsevier', 'Avstraliya', 2001, 'free', 'Q1', 'tourism,management', { wos: 1, acceptance: 3, review_weeks: 12 }),
  S('Journal of Outdoor Recreation and Tourism', 'Elsevier', 'Niderlandiya', 2013, 'paid', 'Q1', 'tourism,natural', { apc_usd: 2500, acceptance: 3, review_weeks: 10 }),
  S('Tourism and Hospitality', 'MDPI', 'Shveytsariya', 2020, 'paid', 'Q2', 'tourism,management', { apc_usd: 1400, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/tourhosp' }),
  S('Administrative Sciences', 'MDPI', 'Shveytsariya', 2011, 'paid', 'Q2', 'management,economics,tourism', { apc_usd: 1800, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/admsci' }),

  // ---------- OAK ro'yxatidagi milliy nashrlar (NAMUNA — oak.uz bilan sinxronlang) ----------
  ...[
    ['Pedagogik mahorat', "Buxoro davlat universiteti", 'free', 'education,pedagogy,vocational'],
    ['Uzluksiz ta’lim', "Respublika ta'lim markazi", 'free', 'education,pedagogy,vocational,highered'],
    ['Xalq ta’limi', "O'zbekiston Respublikasi Xalq ta'limi vazirligi", 'free', 'education,pedagogy'],
    ['Pedagogika', "Nizomiy nomidagi TDPU", 'free', 'education,pedagogy,highered'],
    ['Kasb-hunar ta’limi', "Kasb-hunar ta'limi bo'yicha ilmiy-metodik jurnal", 'free', 'vocational,education'],
    ['Boshlang‘ich ta’lim', "Nizomiy nomidagi TDPU", 'free', 'education,pedagogy'],
    ['Til va adabiyot ta’limi', "Nashriyot-matbaa ijodiy uyi", 'free', 'linguistics,education,humanities'],
    ['Ta’lim fidoyilari', "Ta'lim fidoyilari nashriyoti", 'paid', 'education,pedagogy'],
    ['Zamonaviy ta’lim', "Zamonaviy ta'lim ilmiy-metodik jurnali", 'paid', 'education,edtech,pedagogy'],
    ['Pedagogik ta’lim', "Pedagogik ta'lim ilmiy jurnali", 'free', 'education,pedagogy,highered'],
    ['Maktab va hayot', "Ilmiy-metodik jurnal", 'free', 'education,pedagogy'],
    ['Oliy ta’lim va innovatsiyalar', "Oliy ta'lim ilmiy-uslubiy jurnali", 'free', 'highered,education'],
    ['Raqamli ta’lim texnologiyalari', "Raqamli ta'lim ilmiy jurnali", 'paid', 'edtech,education,cs'],
    ['Axborot texnologiyalari muammolari', "Ilmiy jurnal", 'free', 'cs,engineering'],
    ['Muhandislik va texnologiyalar axborotnomasi', "Texnika universiteti ilmiy axborotnomasi", 'free', 'engineering,energy,materials,cs'],
    ['Energetika muammolari', "Ilmiy-texnik jurnal", 'free', 'energy,engineering'],
    ['Tibbiyotda yangi kun', "Buxoro davlat tibbiyot instituti", 'paid', 'medicine,publichealth'],
    ['Biologiya va tibbiyot muammolari', "Ilmiy jurnal", 'free', 'medicine,natural'],
    ['Agro ilm', "Qishloq xo'jaligi ilmiy-amaliy jurnali", 'free', 'agri,natural'],
    ['Kimyo va kimyo texnologiyasi', "Ilmiy-texnik jurnal", 'free', 'chemistry,natural,materials'],
    ['Huquq va burch', "Ilmiy-amaliy jurnal", 'free', 'law,social'],
    ['Filologiya masalalari', "Ilmiy jurnal", 'free', 'linguistics,humanities'],
  ].map(([name, publisher, access, subjects]) => J({ name, publisher, country: "O'zbekiston", access, oak_status: 'active', subjects, acceptance: access === 'free' ? 4 : 5, review_weeks: access === 'free' ? 6 : 3, oak_url: 'https://oak.uz', description: "OAK ro'yxatidagi milliy nashr (namuna ma'lumot — oak.uz dagi rasmiy ro'yxat bilan tasdiqlang).", official_url: '' })),

  // ---------- Konferensiyalar ----------
  ...[
    ['EDULEARN (International Conference on Education and New Learning Technologies)', 'IATED', 'Ispaniya', 'education,edtech,pedagogy', 'paid', 'Ta’lim va yangi o‘quv texnologiyalari bo‘yicha yirik yillik konferensiya.', 'https://iated.org/edulearn/'],
    ['INTED (International Technology, Education and Development Conference)', 'IATED', 'Ispaniya', 'education,edtech,vocational', 'paid', '', 'https://iated.org/inted/'],
    ['ICERI (International Conference of Education, Research and Innovation)', 'IATED', 'Ispaniya', 'education,pedagogy,highered', 'paid', '', 'https://iated.org/iceri/'],
    ['ECER (European Conference on Educational Research)', 'EERA', 'Yevropa', 'education,pedagogy,highered', 'paid', 'Yevropa ta’lim tadqiqotlari assotsiatsiyasi konferensiyasi.', 'https://eera-ecer.de'],
    ['AERA Annual Meeting', 'American Educational Research Association', 'AQSh', 'education,pedagogy,highered', 'paid', '', 'https://www.aera.net'],
    ['IEEE EDUCON (Global Engineering Education Conference)', 'IEEE', 'Xalqaro', 'engineering,education,cs,edtech', 'paid', '', 'https://www.ieee-educon.org'],
    ['EDEN Annual Conference', 'European Distance and E-Learning Network', 'Yevropa', 'edtech,education', 'paid', '', 'https://www.eden-online.org'],
    ['Respublika ilmiy-amaliy konferensiyalari (OTM va ilmiy markazlar)', 'Oliy ta’lim muassasalari', "O'zbekiston", 'education,pedagogy,vocational,highered', 'free', "Respublika miqyosidagi konferensiyalar to'plamlari — konferensiya talablari uchun. Joriy kalendarni OTM saytlaridan tekshiring.", ''],
    ['Xalqaro ilmiy-amaliy konferensiyalar (O‘zbekiston OTMlari)', 'Oliy ta’lim muassasalari', "O'zbekiston", 'education,economics,cs,engineering,medicine,humanities', 'free', 'Xalqaro maqomdagi konferensiyalar; chiqish va tezis uchun to‘lov shartlari har bir konferensiyada alohida.', ''],
  ].map(([name, publisher, country, subjects, access, description, official_url]) => J({ name, kind: 'conference', publisher, country, subjects, access, acceptance: 4, description, official_url })),
];

const OAK_ECON = require('./data/oak_economics.json');
const oakEconomics = [
  ...OAK_ECON.milliy.map((x) => ['milliy', x]), ...OAK_ECON.mdh.map((x) => ['mdh', x]), ...OAK_ECON.xorijiy.map((x) => ['xorijiy', x]),
].map(([grp, x]) => J({
  name: x.name, kind: 'journal', oak_status: 'active', access: 'free', acceptance: grp === 'milliy' ? 4 : 2,
  country: grp === 'milliy' ? "O'zbekiston" : grp === 'mdh' ? 'MDH' : 'Xorijiy',
  subjects: x.tourism ? 'economics,management,finance,tourism' : 'economics,management,finance',
  official_url: x.url, oak_url: 'https://oak.uz/pages/31738', verified: 1,
  description: grp === 'milliy' ? "OAK ro'yxatidagi (08.00.00 Iqtisodiyot) milliy nashr. To'lov shartlarini jurnal saytidan tekshiring."
    : `OAK ro'yxatidagi (08.00.00) ${grp === 'mdh' ? 'MDH' : 'xorijiy'} nashr. Xorijiy maqola sifatida hisoblanishi uchun jurnalning Scopus/WoS'da FAOL indekslanganini alohida tekshiring.`,
}));
journals.push(...oakEconomics);

const REQ_SRC = 'https://lex.uz/uz/docs/3244217';
const requirements = [
  // PhD: jami 7 ta ish; shundan 3 ta maqola (1 tasi xorijiy) + 2 ta xalqaro konferensiya materiali
  { degree: 'phd', kind: 'oak', title: "OAK ro'yxatidagi nashrlarda maqolalar (milliy)", min_count: 2, description: "PhD uchun jami kamida 3 ta maqola talab qilinadi: 2 tasi OAK ro'yxatidagi nashrlarda (bu qator) va 1 tasi nufuzli xorijiy jurnalda (keyingi qator). Ijtimoiy-gumanitar fanlarda yakka mualliflikda.", source_url: REQ_SRC, verified: 1 },
  { degree: 'phd', kind: 'foreign', title: "Nufuzli xorijiy ilmiy jurnalda maqola (Scopus / Web of Science)", min_count: 1, description: "Eng xavfsiz yo'l — Scopus yoki Web of Science'da faol indekslangan jurnal (OAK 10.06.2026 qoidasi).", source_url: REQ_SRC, verified: 1 },
  { degree: 'phd', kind: 'conf_int', title: "Xalqaro konferensiya to'plamida material (maqola, ma'ruza yoki tezis)", min_count: 2, description: "Kamida 2 ta material xalqaro konferensiya to'plamida.", source_url: REQ_SRC, verified: 1 },
  { degree: 'phd', kind: 'conf_nat', title: "Qo'shimcha ilmiy ishlar (respublika konferensiyasi tezisi, preprint, patent) — jami 7 ta uchun", min_count: 2, description: "Dissertatsiya bo'yicha jami kamida 7 ta ilmiy ish bo'lishi shart (3 maqola + 2 xalqaro konferensiya materiali + yana 2 ta). Tezis, preprint va patent ilmiy ish hisoblanadi; o'quv adabiyotlari (darslik, qo'llanma) hisoblanmaydi.", source_url: REQ_SRC, verified: 1 },
  // DSc: jami 15 ta; shundan 10 ta maqola (1 tasi xorijiy) + 2 ta xalqaro konferensiya materiali
  { degree: 'dsc', kind: 'oak', title: "OAK ro'yxatidagi nashrlarda maqolalar", min_count: 9, description: "DSc uchun ro'yxatdagi nashrlarda jami kamida 10 ta maqola: 9 tasi shu qatorda, 1 tasi xorijiy jurnalda (keyingi qator).", source_url: REQ_SRC, verified: 1 },
  { degree: 'dsc', kind: 'foreign', title: "Rivojlangan xorijiy mamlakatning nufuzli ixtisoslashgan jurnalida maqola", min_count: 1, description: "Scopus / Web of Science'da faol indekslangan jurnal tavsiya etiladi.", source_url: REQ_SRC, verified: 1 },
  { degree: 'dsc', kind: 'conf_int', title: "Xalqaro konferensiya materiallari", min_count: 2, description: "Kamida 2 ta xalqaro konferensiya materiali.", source_url: REQ_SRC, verified: 1 },
  { degree: 'dsc', kind: 'conf_nat', title: "Qo'shimcha ilmiy ishlar (tezis, preprint, patent) — jami 15 ta uchun", min_count: 3, description: "DSc uchun jami kamida 15 ta ilmiy ish (10 maqola + 2 konferensiya + yana 3 ta).", source_url: REQ_SRC, verified: 1 },
  { degree: 'dsc', kind: 'monograph', title: "Monografiya (faqat ijtimoiy-gumanitar fanlar, 2027-yil 1-yanvargacha)", min_count: 0, description: "Ijtimoiy-gumanitar fanlar bo'yicha DSc uchun monografiya talabi 2027-yil 1-yanvardan bekor qilinadi. Agar 2026-yil oxirigacha himoya qilsangiz, bu qatorni 1 ga o'zgartiring.", source_url: REQ_SRC, verified: 1 },
];

const CUT = '2027-01-01';
// [key, category, title, description, phase, required, cancelled_from]
const docs = [
  // --- tajriba-sinov va joriy etish ---
  ['impl_acts', 'implementation', "Natijalarni amaliyotga joriy etish hujjatlari (dalolatnoma, patent, tavsiya)", "Joriy etish haqida OAK xulosasi olish talabi 2027-yil 1-yanvardan bekor bo'ladi, ammo natijaning ahamiyati baribir baholanadi. Shakllari: patent; tugallangan grant loyihasida foydalanilishi; NHH loyihasida foydalanilishi; ta'lim jarayoniga tatbiq (PhD: o'quv qo'llanma); davlat organi yoki xo'jalik boshqaruvi organi ilmiy-texnik kengashi tavsiyasi.", 'mid', 1, CUT],
  ['experiment_ref', 'experiment', "Tajriba-sinov ishlari o'tkazilgani to'g'risida ma'lumotnoma", "Tajriba-sinov o'tkazilgan muassasalardan sana, ishtirokchilar soni va natijalar ko'rsatilgan ma'lumotnoma.", 'mid', 1, ''],
  ['experiment_stats', 'experiment', "Tajriba-sinov natijalarining statistik tahlili", "Tajriba va nazorat guruhlari natijalari, statistik mezonlar (masalan, Student, Pirson χ²) va xulosalar jadvali.", 'mid', 1, ''],
  ['survey', 'experiment', "So'rovnoma / test materiallari va ishonchlilik tahlili", "So'rovnoma shakllari, respondentlar soni, Kronbax alfa kabi ishonchlilik ko'rsatkichlari.", 'early', 0, ''],
  ['edu_materials', 'implementation', "Ishlab chiqilgan o'quv-metodik materiallar (o'quv qo'llanma, modul, metodik tavsiya)", "Metod kengashi / ilmiy kengash tomonidan tasdiqlangan ishlanmalar. Diqqat: o'quv adabiyotlari (darslik, qo'llanma) OAK talab qilgan ilmiy ishlar sonini TO'LDIRMAYDI.", 'mid', 0, ''],
  ['dgu', 'implementation', "Dasturiy mahsulot / intellektual mulk guvohnomasi yoki patent", "Patent va ishlanmalar ilmiy ish hisoblanadi va joriy etish shakli sifatida ham qabul qilinadi.", 'mid', 0, ''],
  ['coauthor_consent', 'defense', "Hammualliflarning yozma roziligi", "Hammualliflikdagi har bir maqola uchun hammualliflarning yozma roziligi. Ijtimoiy-gumanitar fanlarda asosiy ishlar yakka mualliflikda bo'lishi kerak.", 'mid', 0, ''],
  ['scopus_proof', 'defense', "Xorijiy maqola indekslanganligini tasdiqlovchi isbot (Scopus / Web of Science)", "Maqola chop etilgan jurnalning Scopus yoki WoS'da FAOL indekslanganligini tasdiqlovchi havola va skrinshotlar (jurnal OAK 'Scopus'dan chiqarilganlar' ro'yxatida emasligini ham tekshiring).", 'mid', 1, ''],
  // --- malakaviy imtihonlar ---
  ['specialty_exam', 'admin', "Mutaxassislik fani bo'yicha malakaviy imtihon", "Himoyaga faqat tegishli malakaviy imtihonlarni topshirgan izlanuvchilar qo'yiladi.", 'mid', 1, ''],
  ['foreign_lang_exam', 'admin', "Chet tili bo'yicha malakaviy imtihon", "PF-98: 2027-yil 1-yanvardan bekor qilinadi (mustaqil izlanuvchilar bundan mustasno — ular topshirishda davom etadi).", 'mid', 1, CUT],
  // --- himoya hujjatlari ---
  ['dissertation', 'defense', "Dissertatsiya matni", "Kirish (barcha majburiy bandlar), PhD uchun kamida 3 bob / DSc uchun kamida 4 bob, xulosalar, adabiyotlar. Hajm: PhD 60 varaq, DSc 100 varaq (ijtimoiy-gumanitarda +30%). Har bob oxirida xulosa.", 'late', 1, ''],
  ['autoref', 'defense', "Dissertatsiya avtoreferati", "Avtoreferatni chop etish talabi 2027-yil 1-yanvardan bekor bo'ladi. Avtoreferatning nizomga muvofiqligi (kirish qismi, ilmiy yangilik, joriy etish, nashrlar, internetda joylashtirilishi) uchun javobgarlik ilmiy kengashda.", 'late', 1, CUT],
  ['pubs_list', 'defense', "Ilmiy ishlar ro'yxati va nashr nusxalari", "Barcha maqolalar, tezislar, patentlar ro'yxati va nusxalari: PhD uchun jami 7 ta (3 maqola, 1 tasi xorijiy; 2 xalqaro konferensiya materiali), DSc uchun 15 ta. Nashrga topshirilgan, lekin chiqmagan ishlar ko'rsatilmaydi.", 'late', 1, ''],
  ['antiplagiat', 'defense', "Antiplagiat tekshiruvi xulosasi", "Ko'chirmachilik aniqlansa, dissertatsiya muhokamadan olinadi va shu mavzuda qayta himoya huquqi yo'qoladi.", 'late', 1, ''],
  ['supervisor_opinion', 'defense', "Ilmiy rahbar (maslahatchi) xulosasi", "Dissertatsiya bajarilganligi va himoyaga tavsiyasi to'g'risida yozma fikr.", 'late', 1, ''],
  ['prelim_expertise', 'defense', "Muassasa ilmiy seminarining dastlabki ekspertiza xulosasi", "Xulosa PhD uchun 2 oy, DSc uchun 3 oy ichida beriladi — vaqtni oldindan rejalashtiring.", 'late', 1, ''],
  ['leading_org', 'defense', "Dissertatsiyani yetakchi tashkilotda muhokama qilish", "PF-98: 2027-yil 1-yanvardan bekor qilinadi.", 'late', 1, CUT],
  ['oak_topic_reg', 'admin', "Mavzuni OAKda ro'yxatdan o'tkazish va himoya haqida OAK e'loni", "PF-98: 2027-yil 1-yanvardan bekor. 2027-yilgacha OAK e'lon bergan va himoyani o'tkazganlarga daraja eski tartib bo'yicha beriladi.", 'late', 1, CUT],
  ['oak_expert', 'admin', "OAK ekspert kengashi ilmiy ekspertizasi va ilmiy kengash qarorining OAK tomonidan tasdiqlanishi", "PF-98: 2027-yil 1-yanvardan bekor; daraja ilmiy kengash qarori bilan beriladi (kengash qarorini OAK tanlov asosida tekshirishi va bekor qilishi mumkin).", 'late', 1, CUT],
  ['personal_docs', 'admin', "Shaxsiy hujjatlar to'plami", "Ariza, tarjimai hol, diplom nusxalari, mehnat daftarchasi ko'chirmasi, fotosurat. Ilmiy daraja berish my.gov.uz orqali (2026-yil dekabrdan) o'tishi kutilmoqda.", 'late', 1, ''],
  ['council_app', 'admin', "Ilmiy kengashga ariza va hujjatlar to'plami", "Himoya kengashiga topshiriladigan rasmiy ariza va ilovalar. Kengashlar ro'yxati: oak.uz/pages/36, /37, /38.", 'late', 1, ''],
  ['topic_approval', 'admin', "Dissertatsiya mavzusi va ilmiy rahbarni tasdiqlash", "Mavzu muassasa ilmiy kengashida tasdiqlanadi.", 'early', 1, ''],
];

const quotes = [
  ['Isaac Newton', "Agar men boshqalardan uzoqroqni ko‘rgan bo‘lsam, bu devlar yelkasida turganim tufaylidir.", "Robert Gukka maktub, 1675"],
  ['Albert Eynshteyn', "Menda alohida iste’dod yo‘q. Men shunchaki ehtiros bilan qiziquvchanman.", "Karl Zeeligga maktub, 1952"],
  ['Lui Paster', "Kuzatish sohasida tasodif faqat tayyor ongga yordam beradi.", "Lill universitetidagi ma’ruza, 1854"],
  ['Mari Kyuri', "Hayotda qo‘rqinchli narsa yo‘q — faqat anglash kerak bo‘lgan narsalar bor.", "Mashhur ibora (muallifligi an’anaviy tarzda unga nisbat beriladi)"],
  ['Tomas Edison', "Daho — bir foiz ilhom va to‘qson to‘qqiz foiz mehnatdir.", "1932"],
  ['Richard Feynman', "Birinchi tamoyil: o‘zingni aldamaslik kerak — va o‘zingni aldash eng oson ish.", "Caltech bitiruv ma’ruzasi, 1974"],
  ['Mirzo Ulug‘bek', "Dinlar buzilar, shohliklar yo‘qolar, ammo olimlarning ilmi abadiy qolar.", "Ulug‘bekka nisbat beriladigan mashhur ibora"],
  ['Aristotel', "Ta’limning ildizi achchiq, ammo uning mevasi shirindir.", "Aristotelga nisbat beriladigan ibora"],
  ['Konfutsiy', "Yurish qanchalik sekin bo‘lmasin, to‘xtamasang bo‘ldi.", "Konfutsiyga nisbat beriladigan ibora"],
  ['Santyago Ramon-i-Kaxal', "Miyaning qaysi sohasini rivojlantirmoqchi bo‘lsangiz, o‘sha sohada qat’iyat bilan mashq qiling.", "Ramon-i-Kaxal asarlaridagi fikr mazmuni"],
];

const SEED_VERSION = 2;

const insertStmt = (table, obj, ignore = true) => {
  const keys = Object.keys(obj);
  return [`INSERT ${ignore ? 'OR IGNORE ' : ''}INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, ...keys.map((k) => obj[k])];
};

/**
 * Boshlang'ich ma'lumotlarni yuklaydi / yangilaydi (versiyalangan). Admin tahrirlagan yozuvlarga tegmaydi.
 * Barcha qo'shishlar INSERT OR IGNORE — bir vaqtda ishga tushgan bir nechta izolyat (Workers) buzmaydi.
 */
async function seedAll(db) {
  const { getSetting, setSetting, batchChunked } = require('./db');
  const version = Number(await getSetting(db, 'seed_version', '0'));
  if (version >= SEED_VERSION) return;
  const stmts = [];
  for (const d of directions) stmts.push(insertStmt('directions', d));
  for (const j of journals) stmts.push(insertStmt('journals', j));
  for (const [key, category, title, description, phase, required, cancelled_from] of docs) {
    stmts.push(insertStmt('doc_templates', { key, category, title, description, phase, required, cancelled_from }));
    if (version < 2) stmts.push(['UPDATE doc_templates SET category=?, title=?, description=?, phase=?, required=?, cancelled_from=? WHERE key=?', category, title, description, phase, required, cancelled_from, key]);
  }
  if (version < 2) {
    // tekshirilmagan (namuna) talablar rasmiy ma'lumotnoma bilan almashtiriladi; admin tasdiqlaganlari saqlanadi
    stmts.push(['DELETE FROM requirements WHERE verified=0']);
    for (const r of requirements) stmts.push(insertStmt('requirements', r));
    stmts.push(["DELETE FROM journals WHERE verified=0 AND name IN ('Iqtisodiyot va ta’lim','Iqtisodiyot va innovatsion texnologiyalar','Moliya va bank ishi')"]);
  }
  for (const [author, text, note] of quotes) stmts.push(insertStmt('quotes', { author, text, note }));
  await batchChunked(db, stmts, 60);
  await setSetting(db, 'seed_version', SEED_VERSION);
}

module.exports = { seedAll, directions, journals };

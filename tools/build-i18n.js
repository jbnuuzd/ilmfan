'use strict';
/*
 * tools/ru-<guruh>-*.txt (JSON: {"o'zbekcha": "ruscha"}) fayllarini birlashtirib,
 * public/i18n-ru-<guruh>.js (brauzer va server uchun UMD lug'at) ni yaratadi.
 *   node tools/build-i18n.js
 * Guruhlar: ui (interfeys), content (server xabarlari, qo'llanmalar, ma'lumotnoma), data (boshlang'ich ma'lumotlar).
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
for (const group of ['ui', 'content', 'data']) {
  const files = fs.readdirSync(__dirname).filter((f) => new RegExp(`^ru-${group}-.*\\.txt$`).test(f)).sort();
  const dict = {};
  for (const f of files) {
    let part;
    try { part = JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')); } catch (e) { console.error(`${f}: JSON xato — ${e.message}`); process.exit(1); }
    for (const [k, v] of Object.entries(part)) { if (typeof v !== 'string') { console.error(`${f}: "${k}" qiymati matn emas`); process.exit(1); } dict[k] = v; }
  }
  const body = `'use strict';\n// AVTOMATIK YARATILGAN (tools/build-i18n.js) — qo'lda tahrirlamang: tools/ru-${group}-*.txt ni o'zgartiring.\n(function (r, f) { const v = f(); if (typeof module === 'object' && module.exports) module.exports = v; else (r.I18N_PARTS = r.I18N_PARTS || []).push(v); })(typeof self !== 'undefined' ? self : this, function () {\n  return { dict: ${JSON.stringify(dict, null, 1)} };\n});\n`;
  fs.writeFileSync(path.join(root, `public/i18n-ru-${group}.js`), body);
  console.log(`${group}: ${Object.keys(dict).length} ta yozuv (${files.length} fayl)`);
}

'use strict';
/*
 * Dasturchi vositasi: manba fayllardagi o'zbekcha matnlarni topib, lug'atda YO'Q bo'lganlarini chiqaradi.
 *   node tools/i18n-missing.js [fayl...]   (standart: barcha foydalanuvchiga ko'rinadigan manbalar)
 * Natija — lug'atga qo'shish uchun tayyor qatorlar ("kalit": "",).
 */
const fs = require('node:fs');
const path = require('node:path');
const I18N = require('../public/i18n.js');

function extract(src) {
  const out = []; let i = 0; const n = src.length;
  function readString(q) { let s = ''; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') { s += src[i] + src[i + 1]; i += 2; } else s += src[i++]; } i++; return s; }
  function readTemplate() {
    let s = ''; let k = 0; i++;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { s += c + src[i + 1]; i += 2; continue; }
      if (c === '`') { i++; break; }
      if (c === '$' && src[i + 1] === '{') {
        i += 2; let depth = 1;
        while (i < n && depth > 0) { const d = src[i]; if (d === '{') depth++; else if (d === '}') { depth--; if (depth === 0) { i++; break; } } else if (d === '`') { readTemplate(); continue; } else if (d === "'" || d === '"') { readString(d); continue; } i++; }
        s += `{${k++}}`; continue;
      }
      s += c; i++;
    }
    return s;
  }
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; }
    else if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; }
    else if (c === "'" || c === '"') out.push(readString(c));
    else if (c === '`') out.push(readTemplate());
    else i++;
  }
  return out.map((s) => s.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
}

// foydalanuvchiga ko'rinadigan matn belgilari: kod, CSS, SQL, identifikatorlar emas
function looksLikeText(s) {
  if (!/[A-Za-zʻ‘’']/.test(s)) return false;
  if (/[А-Яа-яЁё]/.test(s)) return false; // allaqachon ruscha
  if (/^(https?:|\/|#|\.|--|<|@)/.test(s)) return false;
  if (/^[a-z0-9_.:\-/=[\]#,;%() ]+$/.test(s) && !/\s{1}[a-z]{3,}\s/.test(s) && !/'/.test(s)) return /\s/.test(s) ? /[aeiou]{2}|chi|lar|ish|ni\b|ga\b|da\b|ning/.test(s) && s.split(' ').length > 2 : false;
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|FROM|WHERE|PRAGMA)\b/.test(s)) return false;
  if (/^(px|em|%)|;.*:|:\s*[\d#]|var\(--/.test(s) && !/[ʻ‘’']/.test(s)) return false;
  if (/^[a-z]+([A-Z]\w*)+$/.test(s)) return false;
  if (/^[\w$.]+\(.*\)$/.test(s)) return false;
  return /\s/.test(s) || /[ʻ‘’']/.test(s) || /^[A-Z][a-zʻ‘’']+$/.test(s);
}

function main() {
  const root = path.join(__dirname, '..');
  const parts = [];
  for (const f of ['public/i18n-ru-ui.js', 'public/i18n-ru-content.js', 'public/i18n-ru-data.js']) {
    const p = path.join(root, f); if (fs.existsSync(p)) parts.push(require(p));
  }
  const T = I18N.createTranslator(parts);
  const files = process.argv.slice(2).length ? process.argv.slice(2) : ['public/app.js', 'src/app.js', 'src/planner.js', 'src/guide.js', 'src/knowledge.js', 'src/thesis.js', 'src/recommend.js', 'src/ai.js', 'src/seed.js'];
  for (const f of files) {
    const strs = [...new Set(extract(fs.readFileSync(path.join(root, f), 'utf8')))].filter(looksLikeText);
    const missing = strs.filter((s) => T.tr(s) === s);
    console.log(`\n// ===== ${f}: ${missing.length} ta tarjima yo'q (jami ${strs.length}) =====`);
    for (const s of missing) console.log(`  ${JSON.stringify(s)}: "",`);
  }
}
if (require.main === module) main();
module.exports = { extract, looksLikeText };

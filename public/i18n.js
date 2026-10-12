'use strict';
/*
 * Tarjima yadrosi (brauzer va server uchun bir xil). Lug'at kaliti — o'zbekcha matn;
 * {0}, {1}… o'rinbosarli kalitlar andoza hisoblanadi (dinamik matnlar uchun).
 * Apostrof variantlari (ʻ ‘ ’ ʼ `) va ortiqcha bo'shliqlar moslashtirishda e'tiborga olinmaydi.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.I18N = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const norm = (s) => String(s).replace(/[ʻʼ‘’`´]/g, "'").replace(/\s+/g, ' ').trim();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function createTranslator(parts) {
    const exact = new Map();
    const templates = [];
    for (const part of parts) {
      for (const [k, v] of Object.entries(part.dict || part)) {
        if (typeof v !== 'string' || v === '') continue;
        const nk = norm(k);
        if (/\{\d+\*?\}/.test(nk)) {
          // {0} — "; " chegarasidan o'tmaydi (gaplar adashmasligi uchun); {0*} — istalgan matn
          const segs = nk.split(/(\{\d+\*?\})/);
          const re = new RegExp('^' + segs.map((s) => (/^\{\d+\*\}$/.test(s) ? '(.*?)' : /^\{\d+\}$/.test(s) ? '((?:(?!;\\s).)*?)' : esc(s))).join('') + '$', 's');
          templates.push({ re, ru: v, len: nk.replace(/\{\d+\*?\}/g, '').length });
        } else exact.set(nk, v);
      }
    }
    templates.sort((a, b) => b.len - a.len);

    // [ajratgich, qayta biriktirish belgisi]
    const SEPS = [[/(?<=\n)/, ''], [/\|/, '|'], [/ · /, ' · '], [/(?<=;)\s+/, ' '], [/(?<=[.!?])\s+/, ' '], [/,\s+/, ', ']];
    // aniq moslik yoki andoza (bo'laklashsiz)
    function match(n, depth) {
      if (exact.has(n)) return exact.get(n);
      for (const t of templates) {
        const m = t.re.exec(n);
        if (m) return t.ru.replace(/\{(\d+)\*?\}/g, (_, i) => { const v = m[Number(i) + 1]; return v == null ? '' : tr(v, depth + 1); });
      }
      return null;
    }
    function core(str, depth) {
      const n = norm(str);
      if (!n) return str;
      const direct = match(n, depth);
      if (direct != null) return direct;
      if (depth > 6) return str;
      // oxirgi tinish belgisi ("...;" "...." ":") — gap bo'laklarga bo'linganda qoladi
      const pm = /^(.*\S)([;,.:!?])$/s.exec(n);
      if (pm) { const inner = core(pm[1], depth + 1); if (inner !== pm[1]) return inner + pm[2]; }
      // gap boshidagi bosh harf ("Jurnal mavzulari ..." <-> "jurnal mavzulari ...")
      const c0 = n[0];
      if (c0 !== c0.toLowerCase()) { const lc = c0.toLowerCase() + n.slice(1); const r = match(lc, depth); if (r != null) return r[0].toUpperCase() + r.slice(1); }
      // bo'laklab tarjima: qatorlar, " · ", "; ", gaplar, ", " (ro'yxatlar)
      for (const [sep, joiner] of SEPS) {
        const bits = str.split(sep);
        if (bits.length > 1) {
          let changed = false;
          const out = bits.map((b) => { const r = tr(b, depth + 1); if (r !== b) changed = true; return r; });
          if (changed) return out.join(joiner);
        }
      }
      return str;
    }
    function tr(str, depth = 0) {
      if (typeof str !== 'string' || !str) return str;
      const lead = str.match(/^\s*/)[0], trail = str.match(/\s*$/)[0];
      const core0 = str.slice(lead.length, str.length - trail.length);
      if (!core0) return str;
      const out = core(core0, depth);
      return out === core0 ? str : lead + out + trail;
    }
    function deep(v) {
      if (typeof v === 'string') return tr(v);
      if (Array.isArray(v)) return v.map(deep);
      if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = deep(v[k]); return o; }
      return v;
    }
    return { tr, deep, has: (s) => exact.has(norm(s)), size: exact.size + templates.length };
  }
  return { createTranslator, norm };
});

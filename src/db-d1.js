'use strict';
// Cloudflare D1 ustidan bir xil interfeys
const clean = (a) => a.map((v) => (v === undefined ? null : v));

function wrapD1(d1) {
  return {
    prepare(sql) {
      const bound = (a) => d1.prepare(sql).bind(...clean(a));
      return {
        get: async (...a) => (await bound(a).first()) ?? null,
        all: async (...a) => (await bound(a).all()).results,
        run: async (...a) => { const r = await bound(a).run(); return { changes: r.meta.changes, lastInsertRowid: r.meta.last_row_id }; },
      };
    },
    async batch(items) {
      if (!items.length) return;
      await d1.batch(items.map(([sql, ...a]) => d1.prepare(sql).bind(...clean(a))));
    },
  };
}

module.exports = { wrapD1 };

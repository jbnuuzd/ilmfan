// Cloudflare Workers kirish nuqtasi: D1 (env.DB) + statik fayllar (public/, ASSETS) + /api/*
import appModule from './app.js';
import dbModule from './db.js';
import d1Module from './db-d1.js';
import seedModule from './seed.js';
import authModule from './auth.js';

const { createHandler } = appModule;
const { initSchema } = dbModule;
const { wrapD1 } = d1Module;
const { seedAll } = seedModule;
const { ensureAdmin } = authModule;

let ready; // izolyat umri davomida bir marta: sxema, seed, admin
async function init(env) {
  const db = wrapD1(env.DB);
  await initSchema(db);
  await seedAll(db);
  await ensureAdmin(db, process.env, { allowRandom: false });
  return createHandler(db);
}

export default {
  async fetch(request, env) {
    if (!env.DB) return new Response('D1 bog‘lanmasi (DB) sozlanmagan', { status: 500 });
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    ready ||= init(env).catch((e) => { ready = null; throw e; });
    try {
      return (await ready)(request);
    } catch (e) {
      console.error('init xatosi', e);
      return new Response(JSON.stringify({ error: 'Ishga tushirishda xatolik' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
  },
};

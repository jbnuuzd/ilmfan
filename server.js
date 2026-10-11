'use strict';
/* Mahalliy ishlab chiqish (Node). Cloudflare'da src/worker.mjs ishlatiladi. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { open } = require('./src/db-node');
const { initSchema } = require('./src/db');
const auth = require('./src/auth');
const { seedAll } = require('./src/seed');
const ai = require('./src/ai');
const { createHandler } = require('./src/app');

const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function serveStatic(res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Topilmadi'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

/** Node http <-> Web Request/Response ko'prigi */
function createApp(db) {
  const handle = createHandler(db);
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (!url.pathname.startsWith('/api/')) return serveStatic(res, url.pathname);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v != null) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    headers.set('x-forwarded-for', req.socket.remoteAddress || 'local');
    const response = await handle(new Request(url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) || !body.length ? undefined : body }));
    const out = {};
    response.headers.forEach((v, k) => { if (k !== 'set-cookie') out[k] = v; });
    const cookies = response.headers.getSetCookie?.() || [];
    if (cookies.length) out['set-cookie'] = cookies;
    res.writeHead(response.status, out);
    res.end(Buffer.from(await response.arrayBuffer()));
  });
}

async function start() {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  const db = open(path.join(dataDir, 'ilmiy.db'));
  await initSchema(db);
  await seedAll(db);
  await auth.ensureAdmin(db, process.env, { allowRandom: true });
  const port = Number(process.env.PORT || 3000);
  createApp(db).listen(port, () => console.log(`Ilmiy yuksalish: http://localhost:${port}  (AI: ${ai.enabled() ? 'yoqilgan' : "o'chiq — ANTHROPIC_API_KEY o'rnatilmagan"})`));
}

if (require.main === module) start();
module.exports = { createApp };

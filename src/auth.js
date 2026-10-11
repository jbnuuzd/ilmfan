'use strict';
/* Autentifikatsiya — faqat WebCrypto (Node 22 va Cloudflare Workers'da bir xil ishlaydi). */
const { getSetting, setSetting } = require('./db');

const SESSION_DAYS = 14;
const ITER = 100000; // Cloudflare Workers PBKDF2 uchun maksimal
const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));

async function pbkdf2(pw, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}
function constEq(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
const randomHex = (n) => toHex(crypto.getRandomValues(new Uint8Array(n)));

async function hashPassword(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${toHex(salt)}$${toHex(await pbkdf2(pw, salt, ITER))}`;
}

async function verifyPassword(pw, stored) {
  const [alg, iter, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'pbkdf2') return false;
  return constEq(await pbkdf2(pw, fromHex(saltHex), Number(iter)), fromHex(hashHex));
}

async function sha256Hex(text) { return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text))); }

async function createSession(db, userId) {
  const token = randomHex(32);
  await db.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').run(token, userId, Date.now() + SESSION_DAYS * 864e5);
  return { token, maxAge: SESSION_DAYS * 86400 };
}

async function userFromToken(db, token) {
  if (!token) return null;
  const row = await db.prepare(
    `SELECT u.id, u.login, u.role, u.full_name, s.expires_at FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.token = ?`).get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) { await db.prepare('DELETE FROM sessions WHERE token=?').run(token); return null; }
  return { id: row.id, login: row.login, role: row.role, full_name: row.full_name };
}

/**
 * Admin hisobi faqat muhit o'zgaruvchilaridan (ADMIN_LOGIN / ADMIN_PASSWORD) olinadi.
 * Mahalliy (Node) rejimda parol berilmasa tasodifiy parol yaratiladi; Cloudflare'da bunday qilinmaydi (secret majburiy).
 */
async function ensureAdmin(db, env = {}, { log = console.log, allowRandom = false } = {}) {
  const login = (env.ADMIN_LOGIN || 'admin').toLowerCase();
  let password = env.ADMIN_PASSWORD;
  const existing = await db.prepare("SELECT id FROM users WHERE role='admin'").get();
  if (!password) {
    if (existing) return;
    if (!allowRandom) { log('[ADMIN] ADMIN_PASSWORD secret o‘rnatilmagan — admin hisobi yaratilmadi.'); return; }
    password = randomHex(9);
    log(`\n[ADMIN] ADMIN_PASSWORD berilmagan. Vaqtinchalik admin hisobi:\n        login: ${login}\n        parol: ${password}\n`);
  }
  const fp = await sha256Hex(`${login}\n${password}`);
  if (existing) {
    if ((await getSetting(db, 'admin_fp')) === fp) return;
    await db.prepare('UPDATE users SET login=?, pass_hash=? WHERE id=?').run(login, await hashPassword(password), existing.id);
  } else {
    await db.prepare("INSERT INTO users(login,pass_hash,role,full_name) VALUES(?,?, 'admin','Administrator') ON CONFLICT(login) DO UPDATE SET pass_hash=excluded.pass_hash, role='admin'")
      .run(login, await hashPassword(password));
  }
  await setSetting(db, 'admin_fp', fp);
}

/** Bazaga asoslangan urinishlar limiti (Workers'da xotira izolyatlar o'rtasida ulashilmaydi) */
async function rateLimited(db, key, max = 8, windowMs = 10 * 60e3) {
  const now = Date.now();
  await db.prepare('DELETE FROM login_attempts WHERE ts < ?').run(now - windowMs);
  const { c } = await db.prepare('SELECT COUNT(*) c FROM login_attempts WHERE key=?').get(key);
  if (c >= max) return true;
  await db.prepare('INSERT INTO login_attempts(key,ts) VALUES(?,?)').run(key, now);
  return false;
}
const clearAttempts = (db, key) => db.prepare('DELETE FROM login_attempts WHERE key=?').run(key);

let dummy;
async function dummyVerify(pw) { dummy ||= await hashPassword('dummy'); await verifyPassword(pw, dummy); }

module.exports = { hashPassword, verifyPassword, createSession, userFromToken, ensureAdmin, rateLimited, clearAttempts, dummyVerify };

import type { Context, MiddlewareHandler } from 'hono'
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie'
import type { AppEnv, User } from './env'

const ITER = 100000 // Workers' maximum PBKDF2 iteration count
const enc = new TextEncoder()
const b64 = (a: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(a)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(password: string, salt: Uint8Array, iter: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(await derive(password, salt, ITER))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, iter, salt, hash] = stored.split('$')
  if (alg !== 'pbkdf2') return false
  const got = new Uint8Array(await derive(password, unb64(salt), Number(iter)))
  const want = unb64(hash)
  if (got.length !== want.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i]
  return diff === 0
}

const COOKIE = 'migga_session'
const MAX_AGE = 60 * 60 * 24 * 14

export async function startSession(c: Context<AppEnv>, userId: number) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE
  await setSignedCookie(c, COOKIE, `${userId}.${exp}`, c.env.SESSION_SECRET, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export function endSession(c: Context<AppEnv>) {
  deleteCookie(c, COOKIE, { path: '/' })
}

/** Loads the signed-in staff user (if any) into c.var.user. */
export const loadUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('user', null)
  const raw = await getSignedCookie(c, c.env.SESSION_SECRET, COOKIE)
  if (raw) {
    const [id, exp] = raw.split('.').map(Number)
    if (id && exp > Date.now() / 1000) {
      const u = await c.env.DB.prepare('SELECT id, email, name, role FROM users WHERE id = ? AND active = 1').bind(id).first<User>()
      if (u) c.set('user', u)
    }
  }
  await next()
}

export const requireStaff: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user')) return c.redirect('/login?next=' + encodeURIComponent(new URL(c.req.url).pathname))
  await next()
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const u = c.get('user')
  if (!u) return c.redirect('/login?next=' + encodeURIComponent(new URL(c.req.url).pathname))
  if (u.role !== 'admin') return c.text('Admins only', 403)
  await next()
}

/** Simple brute-force protection: max 10 failed logins per IP per 15 minutes. */
export async function loginAllowed(db: D1Database, ip: string): Promise<boolean> {
  const since = Date.now() - 15 * 60000
  await db.prepare('DELETE FROM login_attempts WHERE at < ?').bind(since).run()
  const r = await db.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND at >= ?').bind(ip, since).first<{ n: number }>()
  return (r?.n ?? 0) < 10
}
export const recordFailedLogin = (db: D1Database, ip: string) =>
  db.prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)').bind(ip, Date.now()).run()

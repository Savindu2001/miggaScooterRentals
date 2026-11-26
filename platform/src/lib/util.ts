import type { Env } from './env'

// ---------- time (Sri Lanka local time, stored as 'YYYY-MM-DD HH:MM') ----------
const pad = (n: number) => String(n).padStart(2, '0')

export function nowLocal(env: Pick<Env, 'TZ_OFFSET_MIN'>): string {
  const d = new Date(Date.now() + Number(env.TZ_OFFSET_MIN || 330) * 60000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
export const todayLocal = (env: Pick<Env, 'TZ_OFFSET_MIN'>) => nowLocal(env).slice(0, 10)

/** Parse 'YYYY-MM-DD HH:MM' or 'YYYY-MM-DDTHH:MM' as minutes since epoch (timezone-free arithmetic). */
export function toMin(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s)
  if (!m) return NaN
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000
}
export function fromMin(min: number): string {
  const d = new Date(min * 60000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
/** Normalise HTML datetime-local value to 'YYYY-MM-DD HH:MM' or '' if invalid. */
export function normDT(s: unknown): string {
  const v = String(s ?? '').trim().replace('T', ' ').slice(0, 16)
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v) && !isNaN(toMin(v)) ? v : ''
}
export function normDate(s: unknown): string {
  const v = String(s ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''
}
export function addDays(date: string, n: number): string {
  return fromMin(toMin(date.length === 10 ? date + ' 00:00' : date) + n * 1440).slice(0, date.length === 10 ? 10 : 16)
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function fmtDT(s?: string | null): string {
  if (!s) return '—'
  const t = toMin(s.length === 10 ? s + ' 00:00' : s)
  if (isNaN(t)) return s
  const d = new Date(t * 60000)
  const base = `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  return s.length === 10 ? base : `${base}, ${s.slice(11, 16)}`
}
export const fmtDate = (s?: string | null) => (s ? fmtDT(s.slice(0, 10)) : '—')

// ---------- money ----------
export const lkr = (n: number | null | undefined) => 'LKR ' + Math.round(Number(n || 0)).toLocaleString('en-US')
export const int = (v: unknown, def = 0) => {
  const n = Math.round(Number(String(v ?? '').replace(/[, ]/g, '')))
  return Number.isFinite(n) ? n : def
}
export const str = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max)

// ---------- ids ----------
export function randomToken(bytes = 18): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Booking reference like MS-2026-0007 (MS scooter, MX experience, MT taxi). Atomic in D1. */
export async function nextRef(db: D1Database, prefix: 'MS' | 'MX' | 'MT', year: string): Promise<string> {
  const row = await db
    .prepare('INSERT INTO counters (name, value) VALUES (?1, 1) ON CONFLICT(name) DO UPDATE SET value = value + 1 RETURNING value')
    .bind(prefix)
    .first<{ value: number }>()
  return `${prefix}-${year}-${String(row!.value).padStart(4, '0')}`
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

export async function getSettings(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  return Object.fromEntries(results.map((r) => [r.key, r.value]))
}

export function waLink(phone: string, text = ''): string {
  let p = phone.replace(/[^\d]/g, '')
  if (p.startsWith('0')) p = '94' + p.slice(1)
  return `https://wa.me/${p}${text ? '?text=' + encodeURIComponent(text) : ''}`
}

export const businessOf = (kind: string) => (kind === 'scooter' ? 'scooter' : kind === 'experience' ? 'experience' : 'taxi')

/** Convert a D1 datetime('now') UTC string to local 'YYYY-MM-DD HH:MM'. */
export const utcToLocal = (env: Pick<Env, 'TZ_OFFSET_MIN'>, utc: string) => fromMin(toMin(utc) + Number(env.TZ_OFFSET_MIN || 330))

/**
 * Card service fee so Migga receives the full amount after the bank's cut.
 * The bank takes pct% of what is swiped, so the fee is grossed up: swipe = amount / (1 - pct/100).
 * Example at 3.5%: LKR 10,000 -> fee 363 -> swipe 10,363 -> bank keeps 363 -> Migga gets 10,000.
 */
export function cardFee(amount: number, pct: number): number {
  if (!(pct > 0) || pct >= 100 || amount <= 0) return 0
  return Math.ceil((amount * pct) / (100 - pct))
}

/** Feature switches from wrangler.toml [vars]: "on" shows the feature on the website. */
export const taxiOn = (env: Pick<Env, 'FEATURE_TAXI'>) => env.FEATURE_TAXI === 'on'
export const permitServiceOn = (env: Pick<Env, 'FEATURE_PERMIT_SERVICE'>) => env.FEATURE_PERMIT_SERVICE === 'on'

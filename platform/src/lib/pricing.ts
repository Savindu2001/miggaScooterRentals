import { toMin } from './util'

export type Vehicle = {
  id: number
  name: string
  plate: string
  description: string
  photo: string
  rate_day: number
  rate_3day: number | null
  rate_week: number | null
  rate_month: number | null
  deposit: number
  owner_name: string | null
  owner_rate_day: number | null
  status: string
}

/** Number of 24h rental days (minimum 1). */
export function rentalDays(start: string, end: string): number {
  const mins = toMin(end) - toMin(start)
  return Math.max(1, Math.ceil(mins / 1440))
}

/**
 * Cheapest combination of day / 3-day / week / month packages covering `days`.
 * Packages may over-cover (e.g. a week is cheaper than 6 single days).
 */
export function bestPrice(v: Pick<Vehicle, 'rate_day' | 'rate_3day' | 'rate_week' | 'rate_month'>, days: number) {
  const packs: { d: number; p: number; label: string }[] = [{ d: 1, p: v.rate_day, label: 'day' }]
  if (v.rate_3day) packs.push({ d: 3, p: v.rate_3day, label: '3-day package' })
  if (v.rate_week) packs.push({ d: 7, p: v.rate_week, label: 'week' })
  if (v.rate_month) packs.push({ d: 30, p: v.rate_month, label: 'month' })
  const best: number[] = new Array(days + 1).fill(Infinity)
  const pick: number[] = new Array(days + 1).fill(-1)
  best[0] = 0
  for (let i = 1; i <= days; i++) {
    for (let k = 0; k < packs.length; k++) {
      const prev = Math.max(0, i - packs[k].d)
      const cost = best[prev] + packs[k].p
      if (cost < best[i]) {
        best[i] = cost
        pick[i] = k
      }
    }
  }
  const counts = new Map<string, number>()
  for (let i = days; i > 0; ) {
    const k = pick[i]
    counts.set(packs[k].label, (counts.get(packs[k].label) || 0) + 1)
    i = Math.max(0, i - packs[k].d)
  }
  const breakdown = [...counts.entries()].map(([l, n]) => `${n} × ${l}`).join(' + ')
  return { total: best[days], breakdown }
}

export type ExtraRow = { id: number; name: string; price: number; per: string; stock: number | null }
export function extraLine(e: ExtraRow, days: number, pax: number) {
  const qty = e.per === 'day' ? days : e.per === 'person' ? pax : 1
  return { extra_id: e.id, name: e.name, qty, unit_price: e.price, total: e.price * qty }
}

/** Statuses that block a scooter. Unsigned (pending) bookings hold the scooter for 2 hours. */
export const BLOCKING_SQL = `(status IN ('confirmed','active') OR (status = 'pending' AND created_at > datetime('now','-2 hours')))`

export async function vehicleIsFree(db: D1Database, vehicleId: number, start: string, end: string, ignoreBookingId = 0) {
  const r = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM bookings WHERE kind='scooter' AND vehicle_id = ?1 AND id != ?4 AND ${BLOCKING_SQL}
       AND start_at < ?3 AND COALESCE(end_at, start_at) > ?2`,
    )
    .bind(vehicleId, start, end, ignoreBookingId)
    .first<{ n: number }>()
  return (r?.n ?? 0) === 0
}

/** Next time each vehicle becomes free after `from` (or null when free now). */
export async function nextFree(db: D1Database, vehicleId: number, from: string): Promise<string | null> {
  const r = await db
    .prepare(
      `SELECT MAX(end_at) AS until FROM bookings WHERE kind='scooter' AND vehicle_id=? AND ${BLOCKING_SQL} AND start_at <= ? AND end_at > ?`,
    )
    .bind(vehicleId, from, from)
    .first<{ until: string | null }>()
  return r?.until ?? null
}

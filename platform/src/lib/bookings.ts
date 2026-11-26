import { fmtDT, lkr } from './util'
import { rentalDays } from './pricing'

export type Booking = {
  id: number; ref: string; token: string; kind: 'scooter' | 'experience' | 'taxi'; status: string
  guest_name: string; email: string; phone: string; nationality: string; dob: string; passport_no: string
  home_address: string; stay_address: string; emergency_contact: string; licence_no: string; licence_country: string
  idp_no: string; permit_option: string; permit_no: string
  vehicle_id: number | null; experience_id: number | null; start_at: string; end_at: string | null; actual_return_at: string | null
  pax: number; pickup_location: string; destination: string; vehicle_type: string; driver_id: number | null
  commission: number; driver_status: string
  rental_price: number; extras_total: number; total: number; deposit: number; cost: number; payment_pref: string
  agreement_version_id: number | null; agreement_text: string | null; signature_key: string | null; signed_at: string | null; signed_ip: string | null
  notes: string; staff_notes: string; review_sent: number; created_at: string
  // joined
  vehicle_name?: string; plate?: string; experience_name?: string; experience_category?: string; experience_includes?: string
  driver_name?: string; driver_phone?: string
}

const SELECT = `SELECT b.*, v.name AS vehicle_name, v.plate, e.name AS experience_name, e.category AS experience_category,
  e.includes AS experience_includes, d.name AS driver_name, d.phone AS driver_phone
  FROM bookings b LEFT JOIN vehicles v ON v.id = b.vehicle_id LEFT JOIN experiences e ON e.id = b.experience_id
  LEFT JOIN drivers d ON d.id = b.driver_id`

export const bookingByToken = (db: D1Database, token: string) =>
  db.prepare(`${SELECT} WHERE b.token = ?`).bind(token).first<Booking>()
export const bookingByRef = (db: D1Database, ref: string) =>
  db.prepare(`${SELECT} WHERE b.ref = ?`).bind(ref.toUpperCase()).first<Booking>()
export const bookingById = (db: D1Database, id: number) => db.prepare(`${SELECT} WHERE b.id = ?`).bind(id).first<Booking>()

export type BookingExtra = { id: number; name: string; qty: number; unit_price: number; total: number }
export async function bookingExtras(db: D1Database, id: number) {
  return (await db.prepare('SELECT id, name, qty, unit_price, total FROM booking_extras WHERE booking_id = ? ORDER BY id').bind(id).all<BookingExtra>()).results
}

export type Money = { due: number; paid: number; balance: number; depositHeld: number; charges: number }
/** What the guest owes and has paid. Deposits are tracked separately from the bill. */
export async function moneySummary(db: D1Database, b: Booking): Promise<Money> {
  const ch = await db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM charges WHERE booking_id = ?').bind(b.id).first<{ s: number }>()
  const p = await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN kind IN ('rental','charge','extension','other') THEN amount ELSE 0 END),0) AS paid,
              COALESCE(SUM(CASE WHEN kind IN ('deposit','deposit_refund') THEN amount ELSE 0 END),0) AS dep
       FROM payments WHERE booking_id = ?`,
    )
    .bind(b.id)
    .first<{ paid: number; dep: number }>()
  const charges = ch?.s ?? 0
  const due = b.total + charges
  const paid = p?.paid ?? 0
  return { due, paid, balance: due - paid, depositHeld: p?.dep ?? 0, charges }
}

const PERMIT: Record<string, string> = {
  have: 'Renter has an AAC / DMT permit',
  arrange: 'Migga arranges the AAC permit',
  airport: 'Renter will get the permit at the airport',
}
export const permitLabel = (b: Booking) => (PERMIT[b.permit_option] || '—') + (b.permit_no ? ` (${b.permit_no})` : '')

/** Fill {placeholders} in the agreement with the booking's values. */
export function fillAgreement(body: string, b: Booking, extras: BookingExtra[], settings: Record<string, string>): string {
  const vars: Record<string, string> = {
    ...settings,
    ref: b.ref, guest_name: b.guest_name, nationality: b.nationality, dob: b.dob, passport_no: b.passport_no,
    phone: b.phone, email: b.email, stay_address: b.stay_address, home_address: b.home_address,
    emergency_contact: b.emergency_contact, licence_no: b.licence_no, licence_country: b.licence_country,
    idp_no: b.idp_no, permit: permitLabel(b), vehicle: b.vehicle_name || '', plate: b.plate || '',
    start: fmtDT(b.start_at), end: fmtDT(b.end_at), days: String(b.end_at ? rentalDays(b.start_at, b.end_at) : 1),
    rental_price: b.rental_price.toLocaleString('en-US'), total: b.total.toLocaleString('en-US'),
    deposit: b.deposit.toLocaleString('en-US'),
    extras: extras.length ? extras.map((e) => `${e.name}${e.qty > 1 ? ' ×' + e.qty : ''} (${e.total ? lkr(e.total) : 'free'})`).join(', ') : 'none',
  }
  return body.replace(/\{([a-z_0-9]+)\}/g, (m, k) => (k in vars ? vars[k] || '—' : m))
}

export const KIND_LABEL: Record<string, string> = { scooter: 'Scooter', experience: 'Safari / tour', taxi: 'Taxi' }
export const STATUS_LABEL: Record<string, string> = {
  pending: 'Not finished', confirmed: 'Confirmed', active: 'Out now', completed: 'Completed', cancelled: 'Cancelled',
}

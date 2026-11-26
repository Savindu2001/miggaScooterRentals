import type { Env } from '../lib/env'
import type { Booking, BookingExtra } from '../lib/bookings'
import { permitLabel } from '../lib/bookings'
import { rentalDays, bestPrice } from '../lib/pricing'
import { fmtDT, lkr } from '../lib/util'

export type AgreementData = {
  b: Booking
  extras: BookingExtra[]
  text: string
  title: string
  settings: Record<string, string>
  damage: { name: string; price: number }[]
  pickup?: { km: number | null; fuel: string; items: string; notes: string; staff: string | null; created_at: string } | null
  rates?: { rate_day: number; rate_3day: number | null; rate_week: number | null; rate_month: number | null } | null
}

/** The renter and rental details are shown as tables, so remove the old prose versions of them from the terms text. */
export function termsOnly(text: string): string {
  const start = text.indexOf('## Rental details')
  const rules = text.indexOf('## Rules and terms')
  if (start >= 0 && rules > start) {
    const intro = text.slice(0, start).trim()
    text = (intro ? intro + '\n' : '') + text.slice(rules)
  }
  // The section already has its own "Terms and conditions" heading.
  return text.replace(/^## Rules and terms\s*$/m, '')
}

function Row(p: { k: string; v?: string | null; wide?: boolean }) {
  return (<tr><th scope="row">{p.k}</th><td colspan={p.wide ? 3 : undefined}>{p.v || '—'}</td></tr>)
}
function Row2(p: { a: string; av?: string | null; b: string; bv?: string | null }) {
  return (<tr><th scope="row">{p.a}</th><td>{p.av || '—'}</td><th scope="row">{p.b}</th><td>{p.bv || '—'}</td></tr>)
}

/** Branded, printable rental agreement (screen and A4 PDF). */
export function AgreementDoc(p: AgreementData & { env: Env; signatureUrl?: string }) {
  const { b, extras, settings: s, env } = p
  const days = b.end_at ? rentalDays(b.start_at, b.end_at) : 1
  const pack = p.rates ? bestPrice(p.rates, days).breakdown : ''
  const terms = termsOnly(p.text)
  return (
    <article class="adoc">
      <header class="adoc-head">
        <div class="adoc-brand">
          <img src="/img/logo.svg" alt="" width="58" height="48" />
          <div>
            <div class="adoc-name">MIGGA SCOOTER RENTAL</div>
            <div class="adoc-sub">Sigiriya, Sri Lanka</div>
          </div>
        </div>
        <div class="adoc-contact">
          <div>Tel / WhatsApp: {env.BUSINESS_PHONE}</div>
          <div>{env.SITE_URL.replace(/^https?:\/\//, '')}</div>
          {s.shop_address && <div>{s.shop_address}</div>}
        </div>
      </header>
      <div class="adoc-titlebar">
        <h1>Scooter Rental Agreement</h1>
        <table class="adoc-meta"><tbody>
          <tr><th>Booking</th><td>{b.ref}</td></tr>
          <tr><th>Version</th><td>{p.title}</td></tr>
          <tr><th>Date</th><td>{b.signed_at ? fmtDT(b.signed_at) : 'Not signed yet'}</td></tr>
        </tbody></table>
      </div>

      <h2>1. Renter details</h2>
      <table class="adoc-t"><tbody>
        <Row k="Full name" v={b.guest_name} wide />
        <Row2 a="Nationality" av={b.nationality} b="Date of birth" bv={b.dob} />
        <Row2 a="Passport no." av={b.passport_no} b="Phone" bv={b.phone} />
        <Row k="Email" v={b.email} wide />
        <Row k="Stay in Sri Lanka" v={b.stay_address} wide />
        <Row k="Home address" v={b.home_address} wide />
        <Row k="Emergency contact" v={b.emergency_contact} wide />
      </tbody></table>

      <h2>2. Driving documents</h2>
      <table class="adoc-t"><tbody>
        <Row2 a="Licence no." av={b.licence_no} b="Issued in" bv={b.licence_country} />
        <Row2 a="IDP no." av={b.idp_no} b="SL permit" bv={permitLabel(b)} />
      </tbody></table>

      <h2>3. Scooter and rental period</h2>
      <table class="adoc-t"><tbody>
        <Row2 a="Scooter" av={b.vehicle_name} b="Registration" bv={b.plate} />
        <Row2 a="Pickup" av={fmtDT(b.start_at)} b="Return" bv={fmtDT(b.end_at)} />
        <Row2 a="Rental days" av={`${days} (1 day = 24 hours)`} b="Pickup at" bv={b.pickup_location} />
      </tbody></table>

      <h2>4. Charges (LKR)</h2>
      <table class="adoc-t adoc-money">
        <thead><tr><th>Item</th><th>Qty</th><th class="num">Amount</th></tr></thead>
        <tbody>
          <tr><td>Scooter rental{pack ? ` (${pack})` : ''}</td><td>{days} day{days > 1 ? 's' : ''}</td><td class="num">{b.rental_price.toLocaleString('en-US')}</td></tr>
          {extras.map((e) => <tr><td>{e.name}</td><td>{e.qty}</td><td class="num">{e.total ? e.total.toLocaleString('en-US') : 'Free'}</td></tr>)}
        </tbody>
        <tfoot>
          <tr><th colspan={2}>Total</th><th class="num">{b.total.toLocaleString('en-US')}</th></tr>
          <tr><td colspan={2}>Refundable security deposit</td><td class="num">{b.deposit.toLocaleString('en-US')}</td></tr>
          {Number(s.card_fee_pct) > 0 && <tr><td colspan={3} class="adoc-note">Card payments: +{s.card_fee_pct}% card service fee charged by the bank. Cash has no fee.</td></tr>}
        </tfoot>
      </table>

      {p.pickup && (
        <>
          <h2>5. Condition at pickup</h2>
          <table class="adoc-t"><tbody>
            <Row2 a="Odometer" av={p.pickup.km != null ? `${p.pickup.km.toLocaleString('en-US')} km` : '—'} b="Fuel" bv={p.pickup.fuel} />
            <Row k="Handed over" v={p.pickup.items} wide />
            <Row k="Existing marks" v={p.pickup.notes || 'None noted'} wide />
          </tbody></table>
        </>
      )}

      <h2>{p.pickup ? '6' : '5'}. Terms and conditions</h2>
      <div class="adoc-terms">
        {terms.split('\n').map((line) => {
          const l = line.trim()
          if (!l) return null
          if (l.startsWith('## ')) return <h3>{l.slice(3)}</h3>
          const m = /^(\d+)\.\s+(.*?\.)\s(.*)$/.exec(l)
          return m ? <p><b>{m[1]}. {m[2]}</b> {m[3]}</p> : <p>{l}</p>
        })}
      </div>

      {p.damage.length > 0 && (
        <>
          <h2>{p.pickup ? '7' : '6'}. Damage price list (LKR)</h2>
          <table class="adoc-t adoc-money">
            <thead><tr><th>Item</th><th class="num">Charge</th></tr></thead>
            <tbody>{p.damage.map((d) => <tr><td>{d.name}</td><td class="num">{d.price.toLocaleString('en-US')}</td></tr>)}</tbody>
          </table>
          <p class="adoc-note">Damage not listed is charged at the actual repair cost.</p>
        </>
      )}

      <div class="adoc-signblock">
      <h2>Signatures</h2>
      <table class="adoc-t adoc-sign">
        <thead><tr><th>Renter</th><th>Owner / representative</th></tr></thead>
        <tbody>
          <tr>
            <td class="sigbox">{p.signatureUrl ? <img src={p.signatureUrl} alt={`Signature of ${b.guest_name}`} /> : <span class="adoc-note">Not signed yet</span>}</td>
            <td class="sigbox"><span class="adoc-note">{p.pickup?.staff ? `Checked and handed over by ${p.pickup.staff}` : ''}</span></td>
          </tr>
          <tr><td>Name: {b.guest_name}</td><td>Name: {p.pickup?.staff || 'Migga Scooter Rental'}</td></tr>
          <tr><td>Date: {b.signed_at ? fmtDT(b.signed_at) : '—'}</td><td>Date: {p.pickup ? fmtDT(p.pickup.created_at) : '—'}</td></tr>
        </tbody>
      </table>
      {b.signed_at && (
        <p class="adoc-note">Signed electronically by {b.guest_name} on {fmtDT(b.signed_at)}{b.signed_ip ? ` from IP address ${b.signed_ip}` : ''}. Valid under the Electronic Transactions Act No. 19 of 2006 (Sri Lanka).</p>
      )}
      </div>
      <footer class="adoc-foot">Migga Scooter Rental · Sigiriya, Sri Lanka · {env.BUSINESS_PHONE} · {env.SITE_URL.replace(/^https?:\/\//, '')} · Booking {b.ref} · Total {lkr(b.total)}</footer>
    </article>
  )
}

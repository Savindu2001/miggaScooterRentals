import { Hono } from 'hono'
import { raw } from 'hono/html'
import type { AppEnv, Env } from '../lib/env'
import { GuestPage, Flash } from '../views/layout'
import { AgreementDoc, type AgreementData } from '../views/agreementDoc'
import { bestPrice, extraLine, rentalDays, vehicleIsFree, BLOCKING_SQL, type ExtraRow, type Vehicle } from '../lib/pricing'
import { utcToLocal, addDays, fmtDT, getSettings, int, isEmail, lkr, nextRef, normDate, normDT, nowLocal, permitServiceOn, randomToken, str, taxiOn, toMin, todayLocal, waLink } from '../lib/util'
import { bookingByToken, bookingExtras, fillAgreement, moneySummary, permitLabel, STATUS_LABEL, type Booking } from '../lib/bookings'
import { putSignature, putUpload } from '../lib/files'
import { qrSvg } from '../lib/qr'
import { adminAlertEmail, experienceConfirmedEmail, extensionEmail, scooterConfirmedEmail, sendMail, taxiEmail } from '../lib/email'

const app = new Hono<AppEnv>()

const later = (c: any, p: Promise<unknown>) => {
  try { c.executionCtx.waitUntil(p) } catch { /* not in a request context */ }
}

function alertAdmin(c: any, b: Booking, what: string) {
  const env: Env = c.env
  if (env.ADMIN_NOTIFY_EMAIL) later(c, sendMail(env, env.ADMIN_NOTIFY_EMAIL, `${what}: ${b.ref} · ${b.guest_name}`, adminAlertEmail(env, b, what)))
}

/** Everything the printable agreement needs. Uses the signed snapshot text when the booking is signed. */
async function agreementData(env: Env, b: Booking): Promise<AgreementData> {
  const [extras, settings, ver, damage, pickup, rates] = await Promise.all([
    bookingExtras(env.DB, b.id),
    getSettings(env.DB),
    env.DB.prepare('SELECT title, body FROM agreement_versions WHERE id = ?').bind(b.agreement_version_id).first<{ title: string; body: string }>()
      .then((v) => v || env.DB.prepare('SELECT title, body FROM agreement_versions WHERE active = 1 ORDER BY id DESC LIMIT 1').first<{ title: string; body: string }>()),
    env.DB.prepare('SELECT name, price FROM damage_items WHERE active = 1 AND price > 0 ORDER BY id').all<{ name: string; price: number }>(),
    env.DB.prepare("SELECT i.km, i.fuel, i.items, i.notes, i.created_at, u.name AS staff FROM inspections i LEFT JOIN users u ON u.id = i.staff_id WHERE i.booking_id = ? AND i.stage = 'pickup' ORDER BY i.id LIMIT 1").bind(b.id).first<any>(),
    b.vehicle_id ? env.DB.prepare('SELECT rate_day, rate_3day, rate_week, rate_month FROM vehicles WHERE id = ?').bind(b.vehicle_id).first<any>() : null,
  ])
  const text = b.agreement_text || fillAgreement(ver?.body || '', b, extras, settings)
  return {
    b, extras, settings, text, title: ver?.title || 'Scooter Rental Agreement', damage: damage.results, rates,
    pickup: pickup ? { ...pickup, created_at: utcToLocal(env, pickup.created_at) } : null,
  }
}

// ======================= SCOOTER =======================
function validRange(env: Env, start: string, end: string): string | null {
  if (!start || !end) return 'Please choose pickup and return times.'
  if (toMin(end) <= toMin(start)) return 'Return must be after pickup.'
  if (toMin(start) < toMin(nowLocal(env)) - 60) return 'Pickup time is in the past.'
  if (toMin(end) - toMin(start) > 90 * 1440) return 'For rentals longer than 90 days please contact us on WhatsApp.'
  return null
}

async function extrasFor(db: D1Database, applies: 'scooter' | 'experience') {
  return (await db.prepare(`SELECT id, name, price, per, stock FROM extras WHERE active=1 AND applies_to IN (?, 'all') ORDER BY sort, id`).bind(applies).all<ExtraRow>()).results
}

/** How many of a limited-stock extra are already out in this period. */
async function extraInUse(db: D1Database, extraId: number, start: string, end: string) {
  const r = await db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN be.qty > 0 THEN 1 ELSE 0 END),0) AS n FROM booking_extras be JOIN bookings b ON b.id = be.booking_id
     WHERE be.extra_id = ? AND b.kind='scooter' AND ${BLOCKING_SQL.replace(/status/g, 'b.status').replace(/created_at/g, 'b.created_at')} AND b.start_at < ? AND b.end_at > ?`,
  ).bind(extraId, end, start).first<{ n: number }>()
  return r?.n ?? 0
}

app.get('/book/scooter', async (c) => {
  const env = c.env
  const q = c.req.query()
  const start = normDT(q.start) || addDays(todayLocal(env), 1) + ' 09:00'
  const end = normDT(q.end) || addDays(todayLocal(env), 4) + ' 09:00'
  const rangeErr = q.start ? validRange(env, start, end) : null
  const days = rentalDays(start, end)
  const { results: vs } = await env.DB.prepare("SELECT * FROM vehicles WHERE status='active' ORDER BY sort, id").all<Vehicle>()
  const avail = await Promise.all(vs.map((v) => vehicleIsFree(env.DB, v.id, start, end)))
  const chosen = Number(q.vehicle) || vs.find((_, i) => avail[i])?.id || 0
  const extras = await extrasFor(env.DB, 'scooter')
  const s = await getSettings(env.DB)
  const permitFee = int(s.permit_service_price)
  return c.html(
    <GuestPage env={env} title="Book a scooter" wide>
      <div class="steps" aria-hidden="true"><i class="cur"></i><i></i><i></i><i></i></div>
      <h1 style="font-size:30px">Book a scooter</h1>
      <form method="get" action="/book/scooter" class="card flat row" style="align-items:end">
        <label style="flex:1 1 200px">Pickup<input type="datetime-local" name="start" value={start.replace(' ', 'T')} required /></label>
        <label style="flex:1 1 200px">Return<input type="datetime-local" name="end" value={end.replace(' ', 'T')} required /></label>
        <button class="btn dark">Update</button>
      </form>
      <Flash msg={rangeErr || q.error} kind="bad" />
      {!rangeErr && (
        <form method="post" action="/book/scooter" class="stack mt">
          <input type="hidden" name="start" value={start} />
          <input type="hidden" name="end" value={end} />
          <p class="muted" style="margin:0">{fmtDT(start)} → {fmtDT(end)} · <b>{days} day{days > 1 ? 's' : ''}</b></p>
          <fieldset>
            <legend>Choose your scooter</legend>
            <div class="stack">
              {vs.map((v, i) => {
                const p = bestPrice(v, days)
                return (
                  <label class="check card flat" style={`justify-content:space-between;${avail[i] ? '' : 'opacity:.55'}`}>
                    <span class="row" style="gap:12px">
                      <input type="radio" name="vehicle_id" value={String(v.id)} checked={v.id === chosen && avail[i]} disabled={!avail[i]} required />
                      {v.photo && <img src={v.photo} alt="" width="64" height="64" style="border-radius:10px;width:64px;height:64px;object-fit:cover" />}
                      <span><b>{v.name}</b><br /><span class="small muted">{avail[i] ? p.breakdown : 'Booked for these dates'}</span></span>
                    </span>
                    <b>{avail[i] ? lkr(p.total) : '—'}</b>
                  </label>
                )
              })}
            </div>
          </fieldset>
          {extras.length > 0 && (
            <fieldset>
              <legend>Extras</legend>
              {extras.map((e) => (
                <label class="check"><input type="checkbox" name="extras" value={String(e.id)} checked={e.price === 0 && e.per !== 'day' && !/delivery/i.test(e.name)} />
                  {e.name} <span class="muted small">{e.price ? `${lkr(e.price)}${e.per === 'day' ? ' per day' : ''}` : 'free'}</span></label>
              ))}
            </fieldset>
          )}
          <fieldset>
            <legend>Sri Lankan driving permit</legend>
            <p class="small muted" style="margin:0 0 6px">Riders need a home licence (motorcycle category), a physical IDP and an AAC / DMT permit.</p>
            {permitServiceOn(env) && <label class="check"><input type="radio" name="permit_option" value="arrange" checked /> Migga arranges my AAC permit {permitFee ? `(+${lkr(permitFee)})` : ''}</label>}
            <label class="check"><input type="radio" name="permit_option" value="have" checked={!permitServiceOn(env)} /> I already have an AAC / DMT permit</label>
            <label class="check"><input type="radio" name="permit_option" value="airport" /> I will get it before pickup (airport counter or AAC office)</label>
          </fieldset>
          <fieldset>
            <legend>Your details</legend>
            <div class="form-grid">
              <label>Full name (as in passport)<input name="guest_name" autocomplete="name" required maxlength={120} /></label>
              <label>Nationality<input name="nationality" required maxlength={60} /></label>
              <label>Date of birth<input type="date" name="dob" required /></label>
              <label>Passport number<input name="passport_no" required maxlength={30} /></label>
              <label>Email<input type="email" name="email" autocomplete="email" required /></label>
              <label>Phone / WhatsApp<input type="tel" name="phone" autocomplete="tel" required /></label>
              <label>Hotel / stay in Sri Lanka<input name="stay_address" required maxlength={200} /></label>
              <label>Home address<input name="home_address" maxlength={200} /></label>
              <label>Emergency contact (name + phone)<input name="emergency_contact" required maxlength={150} /></label>
              <label>Licence number<input name="licence_no" required maxlength={40} /></label>
              <label>Licence country<input name="licence_country" required maxlength={60} /></label>
              <label>IDP number<input name="idp_no" maxlength={40} /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Pickup & payment</legend>
            <label class="check"><input type="radio" name="pickup" value="shop" checked /> Pick up at the Migga shop, Sigiriya</label>
            <label class="check"><input type="radio" name="pickup" value="hotel" /> Deliver to my hotel (Sigiriya area)</label>
            <label class="check"><input type="radio" name="payment_pref" value="shop" checked /> Pay at pickup: cash, or card (+{s.card_fee_pct || 0}% card fee)</label>
            <label class="check"><input type="radio" name="payment_pref" value="bank" /> Bank transfer before pickup (we send details)</label>
          </fieldset>
          <label>Notes (optional)<textarea name="notes" maxlength={1000} style="min-height:70px"></textarea></label>
          <button class="btn big">Next: upload documents</button>
          <p class="tiny muted">Your documents are stored privately and deleted {s.retention_days || 90} days after your rental.</p>
        </form>
      )}
    </GuestPage>,
  )
})

app.post('/book/scooter', async (c) => {
  const env = c.env
  const f = await c.req.parseBody({ all: true })
  const start = normDT(f.start), end = normDT(f.end)
  const back = (msg: string) => c.redirect(`/book/scooter?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&error=${encodeURIComponent(msg)}`)
  const err = validRange(env, start, end)
  if (err) return back(err)
  const v = await env.DB.prepare("SELECT * FROM vehicles WHERE id = ? AND status='active'").bind(int(f.vehicle_id)).first<Vehicle>()
  if (!v) return back('Please choose a scooter.')
  const g = {
    guest_name: str(f.guest_name, 120), nationality: str(f.nationality, 60), dob: normDate(f.dob), passport_no: str(f.passport_no, 30).toUpperCase(),
    email: str(f.email, 160).toLowerCase(), phone: str(f.phone, 30), stay_address: str(f.stay_address, 200), home_address: str(f.home_address, 200),
    emergency_contact: str(f.emergency_contact, 150), licence_no: str(f.licence_no, 40), licence_country: str(f.licence_country, 60), idp_no: str(f.idp_no, 40),
  }
  if (!g.guest_name || !g.passport_no || !g.phone || !g.licence_no || !g.emergency_contact || !g.stay_address) return back('Please fill in all required details.')
  if (!isEmail(g.email)) return back('Please enter a valid email address.')
  const allowed = permitServiceOn(env) ? ['arrange', 'have', 'airport'] : ['have', 'airport']
  const permit = allowed.includes(String(f.permit_option)) ? String(f.permit_option) : 'airport'
  const payment = String(f.payment_pref) === 'bank' ? 'bank' : 'shop'
  const days = rentalDays(start, end)
  const price = bestPrice(v, days).total
  const s = await getSettings(env.DB)

  // Extras
  const ids = new Set((Array.isArray(f.extras) ? f.extras : f.extras ? [f.extras] : []).map((x) => int(x)))
  const all = await extrasFor(env.DB, 'scooter')
  const lines = []
  for (const e of all.filter((e) => ids.has(e.id))) {
    if (e.stock != null && (await extraInUse(env.DB, e.id, start, end)) >= e.stock) return back(`Sorry, "${e.name}" is not available for these dates.`)
    lines.push(extraLine(e, days, 1))
  }
  if (String(f.pickup) === 'hotel' && !lines.some((l) => /delivery/i.test(l.name)) && int(s.delivery_fee))
    lines.push({ extra_id: null as any, name: 'Hotel delivery & collection', qty: 1, unit_price: int(s.delivery_fee), total: int(s.delivery_fee) })
  if (permit === 'arrange' && int(s.permit_service_price))
    lines.push({ extra_id: null as any, name: 'AAC permit service', qty: 1, unit_price: int(s.permit_service_price), total: int(s.permit_service_price) })
  const extrasTotal = lines.reduce((a, l) => a + l.total, 0)

  if (!(await vehicleIsFree(env.DB, v.id, start, end))) return back('Sorry, that scooter was just booked. Please choose another one or other dates.')
  const ag = await env.DB.prepare('SELECT id FROM agreement_versions WHERE active = 1 ORDER BY id DESC LIMIT 1').first<{ id: number }>()
  const ref = await nextRef(env.DB, 'MS', start.slice(0, 4))
  const token = randomToken(24)
  const pickup = String(f.pickup) === 'hotel' ? `Delivered to: ${g.stay_address}` : s.shop_address || 'Migga shop, Sigiriya'
  const ins = await env.DB.prepare(
    `INSERT INTO bookings (ref, token, kind, status, guest_name, email, phone, nationality, dob, passport_no, home_address, stay_address, emergency_contact,
      licence_no, licence_country, idp_no, permit_option, vehicle_id, start_at, end_at, pickup_location, rental_price, extras_total, total, deposit, cost,
      payment_pref, agreement_version_id, notes)
     VALUES (?,?,'scooter','pending',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
  ).bind(ref, token, g.guest_name, g.email, g.phone, g.nationality, g.dob, g.passport_no, g.home_address, g.stay_address, g.emergency_contact,
    g.licence_no, g.licence_country, g.idp_no, permit, v.id, start, end, pickup, price, extrasTotal, price + extrasTotal, v.deposit,
    (v.owner_rate_day || 0) * days, payment, ag?.id ?? null, str(f.notes, 1000)).first<{ id: number }>()
  if (lines.length)
    await env.DB.batch(lines.map((l) => env.DB.prepare('INSERT INTO booking_extras (booking_id, extra_id, name, qty, unit_price, total) VALUES (?,?,?,?,?,?)')
      .bind(ins!.id, l.extra_id ?? null, l.name, l.qty, l.unit_price, l.total)))
  return c.redirect(`/b/${token}/docs`)
})

// ---------- Step 2: documents ----------
const DOCS: [string, string, boolean][] = [
  ['passport', 'Passport photo page', true],
  ['licence', 'Home driving licence (front, showing motorcycle category)', true],
  ['idp', 'International Driving Permit (physical, 1949)', true],
  ['permit', 'AAC / DMT permit (if you have it)', false],
]

async function docTypes(db: D1Database, bookingId: number) {
  return new Set((await db.prepare('SELECT DISTINCT type FROM documents WHERE booking_id = ?').bind(bookingId).all<{ type: string }>()).results.map((r) => r.type))
}

app.get('/b/:token/docs', async (c) => {
  const b = await bookingByToken(c.env.DB, c.req.param('token'))
  if (!b || b.kind !== 'scooter') return c.notFound()
  if (b.status === 'cancelled') return c.redirect(`/b/${b.token}`)
  const have = await docTypes(c.env.DB, b.id)
  return c.html(
    <GuestPage env={c.env} title="Your documents">
      <div class="steps" aria-hidden="true"><i class="on"></i><i class="cur"></i><i></i><i></i></div>
      <h1 style="font-size:28px">Upload your documents</h1>
      <p class="muted">{b.ref} · {b.vehicle_name} · {fmtDT(b.start_at)} → {fmtDT(b.end_at)}</p>
      <Flash msg={c.req.query('error')} kind="bad" />
      <form method="post" enctype="multipart/form-data" class="stack">
        {DOCS.map(([type, label, req]) => (
          <div class="card flat">
            <label>{label}{have.has(type) ? <span class="badge ok" style="align-self:flex-start">Uploaded ✓ (upload again to replace)</span> : !req && <span class="si">optional</span>}
              <input type="file" name={type} accept="image/*,application/pdf" capture="environment" required={req && !have.has(type)} />
            </label>
          </div>
        ))}
        {b.permit_option === 'have' && <label>AAC / DMT permit number<input name="permit_no" value={b.permit_no} maxlength={40} /></label>}
        <p class="tiny muted" style="margin:0">Photos only, max 10 MB each. Stored privately, seen only by Migga staff.</p>
        <button class="btn big">Next: sign the agreement</button>
      </form>
    </GuestPage>,
  )
})

app.post('/b/:token/docs', async (c) => {
  const env = c.env
  const b = await bookingByToken(env.DB, c.req.param('token'))
  if (!b || b.kind !== 'scooter' || b.status === 'cancelled') return c.notFound()
  const f = await c.req.parseBody()
  try {
    for (const [type] of DOCS) {
      const up = await putUpload(env.BUCKET, `bookings/${b.ref}`, f[type])
      if (up) {
        await env.DB.prepare('DELETE FROM documents WHERE booking_id = ? AND type = ?').bind(b.id, type).run()
        await env.DB.prepare('INSERT INTO documents (booking_id, type, r2_key, content_type) VALUES (?,?,?,?)').bind(b.id, type, up.key, up.type).run()
      }
    }
  } catch (e: any) {
    return c.redirect(`/b/${b.token}/docs?error=${encodeURIComponent(e.message || 'Upload failed')}`)
  }
  if (f.permit_no != null) await env.DB.prepare('UPDATE bookings SET permit_no = ? WHERE id = ?').bind(str(f.permit_no, 40), b.id).run()
  const have = await docTypes(env.DB, b.id)
  const missing = DOCS.filter(([t, , req]) => req && !have.has(t)).map(([, l]) => l)
  if (missing.length) return c.redirect(`/b/${b.token}/docs?error=${encodeURIComponent('Still needed: ' + missing.join(', '))}`)
  return c.redirect(`/b/${b.token}/sign`)
})

// ---------- Step 3: sign ----------
app.get('/b/:token/sign', async (c) => {
  const env = c.env
  const b = await bookingByToken(env.DB, c.req.param('token'))
  if (!b || b.kind !== 'scooter') return c.notFound()
  if (b.signed_at) return c.redirect(`/b/${b.token}`)
  const data = await agreementData(env, b)
  return c.html(
    <GuestPage env={env} title="Sign the agreement">
      <div class="steps" aria-hidden="true"><i class="on"></i><i class="on"></i><i class="cur"></i><i></i></div>
      <h1 style="font-size:28px">Check and sign your agreement</h1>
      <Flash msg={c.req.query('error')} kind="bad" />
      <div class="adoc-scroll"><AgreementDoc {...data} env={env} /></div>
      <form method="post" class="stack mt">
        <label class="check"><input type="checkbox" name="agree" value="1" required /> I have read and agree to this rental agreement.</label>
        <div>
          <div class="row between"><b>Sign here</b><button type="button" class="btn ghost sm" data-clear>Clear</button></div>
          <canvas class="sigpad mt" aria-label="Signature pad"></canvas>
        </div>
        <input type="hidden" name="signature" />
        <button class="btn big">Sign and confirm booking</button>
      </form>
      <script src="/js/sign.js" defer></script>
    </GuestPage>,
  )
})

app.post('/b/:token/sign', async (c) => {
  const env = c.env
  const b = await bookingByToken(env.DB, c.req.param('token'))
  if (!b || b.kind !== 'scooter' || b.status === 'cancelled') return c.notFound()
  if (b.signed_at) return c.redirect(`/b/${b.token}`)
  const f = await c.req.parseBody()
  if (f.agree !== '1') return c.redirect(`/b/${b.token}/sign?error=${encodeURIComponent('Please tick the box to agree.')}`)
  let key: string
  try { key = await putSignature(env.BUCKET, `bookings/${b.ref}`, String(f.signature || '')) }
  catch (e: any) { return c.redirect(`/b/${b.token}/sign?error=${encodeURIComponent(e.message)}`) }
  // If the scooter got taken meanwhile (pending hold expired), stop here.
  if (b.status === 'pending' && !(await vehicleIsFree(env.DB, b.vehicle_id!, b.start_at, b.end_at!, b.id)))
    return c.redirect(`/b/${b.token}?error=${encodeURIComponent('Sorry, this scooter was booked by someone else. Please contact us on WhatsApp and we will help.')}`)
  const extras = await bookingExtras(env.DB, b.id)
  const s = await getSettings(env.DB)
  const ag = await env.DB.prepare('SELECT body FROM agreement_versions WHERE id = ?').bind(b.agreement_version_id).first<{ body: string }>()
  const text = fillAgreement(ag?.body || '', b, extras, s)
  const ip = c.req.header('cf-connecting-ip') || ''
  await env.DB.prepare(`UPDATE bookings SET agreement_text=?, signature_key=?, signed_at=?, signed_ip=?, status=CASE WHEN status='pending' THEN 'confirmed' ELSE status END WHERE id=?`)
    .bind(text, key, nowLocal(env), ip, b.id).run()
  const nb = (await bookingByToken(env.DB, b.token))!
  if (b.status === 'pending') {
    later(c, sendMail(env, nb.email, `Booking confirmed ${nb.ref} · Migga Scooter Rental`, scooterConfirmedEmail(env, nb, extras, await moneySummary(env.DB, nb), s)))
    alertAdmin(c, nb, 'New scooter booking')
  }
  return c.redirect(`/b/${b.token}?signed=1`)
})

// ======================= EXPERIENCES =======================
app.post('/book/experience/:slug', async (c) => {
  const env = c.env
  const slug = c.req.param('slug')
  const e = await env.DB.prepare('SELECT * FROM experiences WHERE slug = ? AND active = 1').bind(slug).first<any>()
  if (!e) return c.notFound()
  const f = await c.req.parseBody({ all: true })
  const back = (m: string) => c.redirect(`/experiences/${slug}?error=${encodeURIComponent(m)}`)
  const date = normDate(f.date)
  const slot = String(f.slot || '').trim()
  if (!date || date < todayLocal(env)) return back('Please choose a date from today onwards.')
  if (!e.slots.split(',').map((x: string) => x.trim()).includes(slot)) return back('Please choose a start time.')
  const pax = Math.max(1, Math.min(int(f.pax, 1), e.max_pax))
  const name = str(f.guest_name, 120), email = str(f.email, 160).toLowerCase(), phone = str(f.phone, 30), hotel = str(f.pickup_location, 200)
  if (!name || !phone || !hotel) return back('Please fill in your name, phone and pickup hotel.')
  if (!isEmail(email)) return back('Please enter a valid email address.')
  const start = `${date} ${slot}`
  if (toMin(start) < toMin(nowLocal(env))) return back('That time has already passed.')
  const used = await env.DB.prepare("SELECT COUNT(*) AS n FROM bookings WHERE kind='experience' AND experience_id=? AND start_at=? AND status IN ('pending','confirmed','active')").bind(e.id, start).first<{ n: number }>()
  if ((used?.n ?? 0) >= e.capacity) return back('Sorry, that time is fully booked. Please choose another time or date.')
  const price = e.price_per === 'person' ? e.price * pax : e.price
  const ids = new Set((Array.isArray(f.extras) ? f.extras : f.extras ? [f.extras] : []).map((x) => int(x)))
  const lines = (await extrasFor(env.DB, 'experience')).filter((x) => ids.has(x.id)).map((x) => extraLine(x, 1, pax))
  const extrasTotal = lines.reduce((a, l) => a + l.total, 0)
  const ref = await nextRef(env.DB, 'MX', date.slice(0, 4))
  const token = randomToken(24)
  const r = await env.DB.prepare(
    `INSERT INTO bookings (ref, token, kind, status, guest_name, email, phone, experience_id, start_at, pax, pickup_location, rental_price, extras_total, total, cost, notes)
     VALUES (?,?,'experience','confirmed',?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
  ).bind(ref, token, name, email, phone, e.id, start, pax, hotel, price, extrasTotal, price + extrasTotal, e.cost, str(f.notes, 1000)).first<{ id: number }>()
  if (lines.length) await env.DB.batch(lines.map((l) => env.DB.prepare('INSERT INTO booking_extras (booking_id, extra_id, name, qty, unit_price, total) VALUES (?,?,?,?,?,?)').bind(r!.id, l.extra_id, l.name, l.qty, l.unit_price, l.total)))
  const b = (await bookingByToken(env.DB, token))!
  later(c, sendMail(env, email, `Confirmed: ${b.experience_name} · ${b.ref}`, experienceConfirmedEmail(env, b, await bookingExtras(env.DB, b.id), await moneySummary(env.DB, b))))
  alertAdmin(c, b, `New booking: ${b.experience_name}`)
  return c.redirect(`/b/${token}`)
})

// ======================= TAXI =======================
app.post('/book/taxi', async (c) => {
  const env = c.env
  if (!taxiOn(env)) return c.notFound()
  const f = await c.req.parseBody()
  const back = (m: string) => c.redirect(`/taxi?error=${encodeURIComponent(m)}`)
  const start = normDT(f.start)
  if (!start || toMin(start) < toMin(nowLocal(env))) return back('Please choose a pickup date and time in the future.')
  const name = str(f.guest_name, 120), email = str(f.email, 160).toLowerCase(), phone = str(f.phone, 30)
  if (!name || !phone) return back('Please fill in your name and phone.')
  if (!isEmail(email)) return back('Please enter a valid email address.')
  const vt = ['car', 'van', 'tuk'].includes(String(f.vehicle_type)) ? String(f.vehicle_type) : 'car'
  const route = int(f.route_id) ? await env.DB.prepare('SELECT * FROM taxi_routes WHERE id = ? AND active = 1').bind(int(f.route_id)).first<any>() : null
  const dest = route ? route.destination : str(f.destination_other, 200)
  if (!dest) return back('Please choose or type your destination.')
  const s = await getSettings(env.DB)
  let price = route ? (vt === 'van' ? route.price_van : vt === 'car' ? route.price_car : 0) : 0
  if (!price && route?.km) {
    const rate = int(vt === 'van' ? s.taxi_rate_km_van : s.taxi_rate_km_car)
    if (rate) price = Math.max(int(s.taxi_min_fare), Math.ceil((route.km * rate) / 500) * 500)
  }
  const commission = Math.round((price * int(s.taxi_commission_pct, 10)) / 100)
  const ref = await nextRef(env.DB, 'MT', start.slice(0, 4))
  const token = randomToken(24)
  await env.DB.prepare(
    `INSERT INTO bookings (ref, token, kind, status, guest_name, email, phone, start_at, pax, pickup_location, destination, vehicle_type, rental_price, total, commission, notes)
     VALUES (?,?,'taxi','pending',?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(ref, token, name, email, phone, start, Math.max(1, Math.min(int(f.pax, 1), 14)), str(f.pickup_location, 200) || 'Sigiriya', dest, vt, price, price, commission, str(f.notes, 300)).run()
  const b = (await bookingByToken(env.DB, token))!
  later(c, sendMail(env, email, `Taxi request received · ${b.ref}`, taxiEmail(env, b, 'received')))
  alertAdmin(c, b, `Taxi request to ${dest}`)
  return c.redirect(`/b/${token}`)
})

// ======================= GUEST BOOKING PAGE =======================
app.get('/b/:token', async (c) => {
  const env = c.env
  const b = await bookingByToken(env.DB, c.req.param('token'))
  if (!b) return c.notFound()
  const extras = await bookingExtras(env.DB, b.id)
  const m = await moneySummary(env.DB, b)
  const ext = await env.DB.prepare("SELECT * FROM extensions WHERE booking_id = ? ORDER BY id DESC").bind(b.id).all<any>()
  const title = b.kind === 'scooter' ? `${b.vehicle_name}` : b.kind === 'experience' ? `${b.experience_name}` : `Taxi to ${b.destination}`
  const unfinished = b.kind === 'scooter' && b.status === 'pending'
  return c.html(
    <GuestPage env={env} title={b.ref}>
      {c.req.query('signed') && <div class="notice">Booking confirmed! We emailed your confirmation and signed agreement to {b.email}.</div>}
      <Flash msg={c.req.query('error')} kind="bad" />
      <Flash msg={c.req.query('ok')} />
      <div class="row between mt"><h1 style="font-size:28px;margin:0">{title}</h1><span class={`badge ${b.status === 'cancelled' ? 'bad' : b.status === 'pending' ? 'warn' : 'ok'}`}>{b.kind === 'taxi' && b.status === 'pending' ? 'Waiting for confirmation' : STATUS_LABEL[b.status]}</span></div>
      <p class="muted">Booking {b.ref} · {b.guest_name}</p>
      {unfinished && (
        <div class="notice warn">Your booking is not finished yet. <a href={`/b/${b.token}/docs`}>Upload documents</a> and <a href={`/b/${b.token}/sign`}>sign the agreement</a> to confirm it.</div>
      )}
      {b.kind === 'scooter' && !unfinished && b.status !== 'cancelled' && (
        <div class="card stack" style="align-items:center;text-align:center">
          <div class="qr">{raw(qrSvg(`${env.SITE_URL}/staff/booking/${b.ref}`))}</div>
          <b style="font-family:var(--head);font-size:22px;letter-spacing:1px">{b.ref}</b>
          <span class="small muted">Show this QR code at the Migga shop.</span>
        </div>
      )}
      <div class="card mt">
        <dl class="kv">
          {b.kind === 'scooter' && <><dt>Scooter</dt><dd>{b.vehicle_name} · {b.plate}</dd><dt>Pickup</dt><dd>{fmtDT(b.start_at)}</dd><dt>Return</dt><dd>{fmtDT(b.end_at)}</dd><dt>Where</dt><dd>{b.pickup_location}</dd><dt>Permit</dt><dd>{permitLabel(b)}</dd></>}
          {b.kind === 'experience' && <><dt>When</dt><dd>{fmtDT(b.start_at)}</dd><dt>Guests</dt><dd>{b.pax}</dd><dt>Pickup</dt><dd>{b.pickup_location}</dd></>}
          {b.kind === 'taxi' && <><dt>From</dt><dd>{b.pickup_location}</dd><dt>To</dt><dd>{b.destination}</dd><dt>Pickup</dt><dd>{fmtDT(b.start_at)}</dd><dt>Vehicle</dt><dd>{b.vehicle_type}</dd>{b.driver_name && b.driver_status === 'accepted' && <><dt>Driver</dt><dd>{b.driver_name} · <a href={`tel:${b.driver_phone}`}>{b.driver_phone}</a></dd></>}</>}
          <dt>{b.kind === 'taxi' ? 'Trip price' : 'Price'}</dt><dd>{b.rental_price ? lkr(b.rental_price) : 'We will confirm'}</dd>
          {extras.map((e) => <><dt>{e.name}{e.qty > 1 ? ` ×${e.qty}` : ''}</dt><dd>{e.total ? lkr(e.total) : 'Free'}</dd></>)}
          {m.charges > 0 && <><dt>Other charges</dt><dd>{lkr(m.charges)}</dd></>}
          <dt><b>Total</b></dt><dd><b>{b.total ? lkr(m.due) : '—'}</b></dd>
          {m.paid > 0 && <><dt>Paid</dt><dd>{lkr(m.paid)}</dd></>}
          {b.deposit > 0 && <><dt>Refundable deposit</dt><dd>{lkr(b.deposit)}</dd></>}
        </dl>
      </div>
      {b.kind === 'scooter' && b.signed_at && <p class="mt"><a class="btn ghost" href={`/b/${b.token}/agreement`}>View signed agreement</a></p>}
      {b.kind === 'scooter' && ['confirmed', 'active'].includes(b.status) && b.end_at && (
        <form method="post" action={`/b/${b.token}/extend`} class="card stack mt">
          <h2 style="font-size:20px;margin:0">Need more time?</h2>
          {ext.results.filter((x) => x.status === 'pending').map((x) => <div class="notice warn">Extension to {fmtDT(x.new_end_at)} requested, waiting for confirmation.</div>)}
          <label>New return time<input type="datetime-local" name="new_end" min={b.end_at.replace(' ', 'T')} value={addDays(b.end_at, 1).replace(' ', 'T')} required /></label>
          <button class="btn dark">Request extension</button>
        </form>
      )}
      <p class="small muted mt">Questions? <a href={waLink(env.WHATSAPP, `Hi Migga, about booking ${b.ref}`)}>WhatsApp us</a></p>
    </GuestPage>,
  )
})

app.post('/b/:token/extend', async (c) => {
  const env = c.env
  const b = await bookingByToken(env.DB, c.req.param('token'))
  if (!b || b.kind !== 'scooter' || !['confirmed', 'active'].includes(b.status) || !b.end_at) return c.notFound()
  const f = await c.req.parseBody()
  const newEnd = normDT(f.new_end)
  if (!newEnd || toMin(newEnd) <= toMin(b.end_at)) return c.redirect(`/b/${b.token}?error=${encodeURIComponent('Please choose a time after your current return time.')}`)
  if (!(await vehicleIsFree(env.DB, b.vehicle_id!, b.end_at, newEnd, b.id)))
    return c.redirect(`/b/${b.token}?error=${encodeURIComponent('Sorry, the scooter is booked by someone else then. WhatsApp us and we will try to help.')}`)
  const v = await env.DB.prepare('SELECT rate_day FROM vehicles WHERE id = ?').bind(b.vehicle_id).first<{ rate_day: number }>()
  const amount = rentalDays(b.end_at, newEnd) * (v?.rate_day || 0)
  await env.DB.prepare("UPDATE extensions SET status='rejected' WHERE booking_id = ? AND status='pending'").bind(b.id).run()
  await env.DB.prepare('INSERT INTO extensions (booking_id, new_end_at, amount) VALUES (?,?,?)').bind(b.id, newEnd, amount).run()
  later(c, sendMail(env, b.email, `Extension requested · ${b.ref}`, extensionEmail(env, b, newEnd, amount, false)))
  alertAdmin(c, b, `Extension request to ${fmtDT(newEnd)}`)
  return c.redirect(`/b/${b.token}?ok=${encodeURIComponent('Extension requested. We confirm by email shortly.')}`)
})

app.get('/b/:token/agreement', async (c) => {
  const env = c.env
  const b = await bookingByToken(env.DB, c.req.param('token'))
  if (!b || b.kind !== 'scooter') return c.notFound()
  const data = await agreementData(env, b)
  return c.html(
    <GuestPage env={env} title={`Agreement ${b.ref}`} wide>
      <div class="row between noprint" style="margin-bottom:16px">
        <a href={`/b/${b.token}`}>← Back to booking</a>
        <button class="btn dark" onclick="window.print()">Print / Save as PDF</button>
      </div>
      <AgreementDoc {...data} env={env} signatureUrl={b.signed_at ? `/b/${b.token}/signature.png` : undefined} />
    </GuestPage>,
  )
})

app.get('/b/:token/signature.png', async (c) => {
  const b = await bookingByToken(c.env.DB, c.req.param('token'))
  if (!b?.signature_key) return c.notFound()
  const o = await c.env.BUCKET.get(b.signature_key)
  if (!o) return c.notFound()
  return c.body(o.body, 200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600' })
})

export default app

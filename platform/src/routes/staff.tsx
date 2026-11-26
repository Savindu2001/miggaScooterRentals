import { Hono } from 'hono'
import type { AppEnv, Env } from '../lib/env'
import { AdminPage, Flash } from '../views/layout'
import { CamInput } from '../views/cam'
import { requireStaff } from '../lib/auth'
import { bookingByRef, bookingExtras, KIND_LABEL, moneySummary, permitLabel, STATUS_LABEL, type Booking } from '../lib/bookings'
import { businessOf, cardFee, utcToLocal, fmtDT, getSettings, int, lkr, normDT, nowLocal, str, todayLocal, toMin, waLink } from '../lib/util'
import { putUpload } from '../lib/files'
import { rentalDays, vehicleIsFree } from '../lib/pricing'
import { extensionEmail, pickupEmail, returnEmail, sendMail, taxiEmail } from '../lib/email'

const app = new Hono<AppEnv>()
app.use('/staff/*', requireStaff)
app.use('/staff', requireStaff)
app.use('/files/*', requireStaff)

const later = (c: any, p: Promise<unknown>) => { try { c.executionCtx.waitUntil(p) } catch {} }
const back = (c: any, ref: string, msg: string, kind = 'ok') => c.redirect(`/staff/booking/${ref}?${kind}=${encodeURIComponent(msg)}`)

// ---------- private files (documents, photos) ----------
app.get('/files/:key{.+}', async (c) => {
  const o = await c.env.BUCKET.get(c.req.param('key'))
  if (!o) return c.notFound()
  return c.body(o.body, 200, { 'Content-Type': o.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'private, max-age=3600', 'X-Robots-Tag': 'noindex' })
})

// ---------- today ----------
app.get('/staff', async (c) => {
  const env = c.env, user = c.get('user')!
  const today = todayLocal(env), now = nowLocal(env)
  const q = str(c.req.query('q'), 60)
  if (q) {
    const exact = await bookingByRef(env.DB, q)
    if (exact) return c.redirect(`/staff/booking/${exact.ref}`)
  }
  const list = q
    ? (await env.DB.prepare(`SELECT b.*, v.name AS vehicle_name, e.name AS experience_name FROM bookings b LEFT JOIN vehicles v ON v.id=b.vehicle_id LEFT JOIN experiences e ON e.id=b.experience_id
        WHERE b.guest_name LIKE ?1 OR b.phone LIKE ?1 OR b.ref LIKE ?1 OR b.passport_no LIKE ?1 ORDER BY b.start_at DESC LIMIT 30`).bind(`%${q}%`).all<Booking>()).results
    : (await env.DB.prepare(`SELECT b.*, v.name AS vehicle_name, e.name AS experience_name FROM bookings b LEFT JOIN vehicles v ON v.id=b.vehicle_id LEFT JOIN experiences e ON e.id=b.experience_id
        WHERE b.status IN ('pending','confirmed','active') AND (substr(b.start_at,1,10) = ?1 OR (b.status='active' AND substr(b.end_at,1,10) <= ?1) OR (b.kind='taxi' AND b.status='pending'))
        ORDER BY CASE WHEN b.status='active' THEN b.end_at ELSE b.start_at END`).bind(today).all<Booking>()).results
  return c.html(
    <AdminPage env={env} user={user} path="/staff" title="Shop today">
      <div class="row between"><h1 style="font-size:28px;margin:0">Shop today <span class="si">· අද</span></h1><span class="muted">{fmtDT(now)}</span></div>
      <form class="row" method="get" action="/staff">
        <input name="q" value={q} placeholder="Booking ref, name, phone or passport · සොයන්න" style="flex:1 1 260px" />
        <button class="btn dark">Search</button>
        <a class="btn ghost" href="/book/scooter">+ Walk-in booking</a>
      </form>
      <p class="small muted" style="margin:0">Tip: scan the guest's QR code with the tablet camera. It opens their booking here.</p>
      <div class="card scroll">
        <table class="t">
          <thead><tr><th>Time</th><th>Type</th><th>Guest</th><th>What</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((b) => {
              const isReturn = b.status === 'active'
              const overdue = isReturn && b.end_at && b.end_at < now
              return (
                <tr>
                  <td>{isReturn ? `Return ${fmtDT(b.end_at).split(', ')[1] || ''}` : fmtDT(b.start_at).split(', ')[1] || fmtDT(b.start_at)}<br /><span class="tiny muted">{(isReturn ? b.end_at : b.start_at)?.slice(0, 10)}</span></td>
                  <td>{KIND_LABEL[b.kind]}</td>
                  <td>{b.guest_name}<br /><span class="tiny muted">{b.ref}</span></td>
                  <td>{b.kind === 'scooter' ? b.vehicle_name : b.kind === 'experience' ? b.experience_name : `→ ${b.destination}`}</td>
                  <td><span class={`badge ${overdue ? 'bad' : b.status === 'pending' ? 'warn' : 'ok'}`}>{overdue ? 'Late return' : STATUS_LABEL[b.status]}</span></td>
                  <td><a class="btn sm dark" href={`/staff/booking/${b.ref}`}>Open</a></td>
                </tr>
              )
            })}
            {!list.length && <tr><td colspan={6} class="muted">Nothing {q ? 'found' : 'scheduled today'}.</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminPage>,
  )
})

// ---------- booking detail (shop tablet + admin) ----------
const ANGLES_PICKUP = ['front', 'back', 'left', 'right', 'odometer', 'fuel']
const FUEL = ['Empty', '¼', '½', '¾', 'Full']

function lateCharge(b: Booking, now: string, s: Record<string, string>, rateDay: number) {
  if (!b.end_at) return { minutes: 0, amount: 0 }
  const minutes = toMin(now) - toMin(b.end_at)
  if (minutes <= int(s.late_grace_min, 60)) return { minutes: Math.max(0, minutes), amount: 0 }
  const hours = Math.ceil(minutes / 60)
  if (hours > int(s.late_full_day_hours, 4)) return { minutes, amount: Math.ceil(minutes / 1440) * rateDay }
  return { minutes, amount: hours * int(s.late_fee_hour, 500) }
}

app.get('/staff/booking/:ref', async (c) => {
  const env = c.env, user = c.get('user')!
  const b = await bookingByRef(env.DB, c.req.param('ref'))
  if (!b) return c.html(<AdminPage env={env} user={user} path="/staff" title="Not found"><div class="notice bad">No booking {c.req.param('ref')}.</div><a href="/staff">Back</a></AdminPage>, 404)
  const [extras, m, s] = await Promise.all([bookingExtras(env.DB, b.id), moneySummary(env.DB, b), getSettings(env.DB)])
  const docs = (await env.DB.prepare('SELECT * FROM documents WHERE booking_id = ? ORDER BY id').bind(b.id).all<any>()).results
  const pays = (await env.DB.prepare('SELECT p.*, u.name AS staff FROM payments p LEFT JOIN users u ON u.id=p.staff_id WHERE booking_id = ? ORDER BY p.id').bind(b.id).all<any>()).results
  const charges = (await env.DB.prepare('SELECT * FROM charges WHERE booking_id = ? ORDER BY id').bind(b.id).all<any>()).results
  const insps = (await env.DB.prepare('SELECT i.*, u.name AS staff FROM inspections i LEFT JOIN users u ON u.id=i.staff_id WHERE booking_id = ? ORDER BY i.id').bind(b.id).all<any>()).results
  const photos = insps.length ? (await env.DB.prepare(`SELECT * FROM inspection_photos WHERE inspection_id IN (${insps.map(() => '?').join(',')})`).bind(...insps.map((i) => i.id)).all<any>()).results : []
  const exts = (await env.DB.prepare("SELECT * FROM extensions WHERE booking_id = ? ORDER BY id DESC").bind(b.id).all<any>()).results
  const damage = (await env.DB.prepare('SELECT * FROM damage_items WHERE active = 1 ORDER BY id').all<any>()).results
  const drivers = b.kind === 'taxi' ? (await env.DB.prepare("SELECT id, name, phone, vehicle_type, token FROM drivers WHERE status='approved' ORDER BY name").all<any>()).results : []
  const v = b.vehicle_id ? await env.DB.prepare('SELECT rate_day FROM vehicles WHERE id=?').bind(b.vehicle_id).first<{ rate_day: number }>() : null
  const now = nowLocal(env)
  const late = b.status === 'active' ? lateCharge(b, now, s, v?.rate_day || 0) : { minutes: 0, amount: 0 }
  const pickupInsp = insps.find((i) => i.stage === 'pickup')
  const pickupPhoto = (angle: string) => photos.find((p) => p.inspection_id === pickupInsp?.id && p.angle === angle)
  const has = (t: string) => docs.some((d) => d.type === t)
  const isAdmin = user.role === 'admin'
  const driver = drivers.find((d) => d.id === b.driver_id)
  const docTile = (t: string, label: string, opt = false) => (
    <div class={`tile ${has(t) ? '' : opt ? 'warn' : 'bad'}`}>{label}<b>{has(t) ? '✓ Uploaded' : opt ? 'Not uploaded' : 'Missing'}</b></div>
  )
  return c.html(
    <AdminPage env={env} user={user} path={isAdmin ? '/admin/bookings' : '/staff'} title={b.ref}>
      <Flash msg={c.req.query('ok')} />
      <Flash msg={c.req.query('error')} kind="bad" />
      <div class="row between">
        <div><h1 style="font-size:28px;margin:0">{b.guest_name}</h1><span class="muted">{b.ref} · {KIND_LABEL[b.kind]} · {b.nationality}</span></div>
        <span class={`badge ${b.status === 'cancelled' ? 'bad' : b.status === 'pending' ? 'warn' : 'ok'}`} style="font-size:15px">{STATUS_LABEL[b.status]}</span>
      </div>

      <div class="grid" style="align-items:start">
        <div class="card stack">
          <dl class="kv">
            <dt>Phone</dt><dd><a href={`tel:${b.phone}`}>{b.phone}</a> · <a href={waLink(b.phone)}>WhatsApp</a></dd>
            <dt>Email</dt><dd>{b.email}</dd>
            {b.kind === 'scooter' && <><dt>Scooter <span class="si">ස්කූටරය</span></dt><dd><b>{b.vehicle_name} · {b.plate}</b></dd><dt>Pickup</dt><dd>{fmtDT(b.start_at)}</dd><dt>Return</dt><dd>{fmtDT(b.end_at)}</dd>
              <dt>Where</dt><dd>{b.pickup_location}</dd><dt>Passport</dt><dd>{b.passport_no}</dd><dt>DOB</dt><dd>{b.dob}</dd><dt>Licence</dt><dd>{b.licence_no} ({b.licence_country})</dd><dt>IDP</dt><dd>{b.idp_no || '—'}</dd>
              <dt>Permit</dt><dd>{permitLabel(b)}</dd><dt>Staying at</dt><dd>{b.stay_address}</dd><dt>Emergency</dt><dd>{b.emergency_contact}</dd></>}
            {b.kind === 'experience' && <><dt>Experience</dt><dd><b>{b.experience_name}</b></dd><dt>When</dt><dd>{fmtDT(b.start_at)}</dd><dt>Guests</dt><dd>{b.pax}</dd><dt>Pickup</dt><dd>{b.pickup_location}</dd></>}
            {b.kind === 'taxi' && <><dt>From</dt><dd>{b.pickup_location}</dd><dt>To</dt><dd><b>{b.destination}</b></dd><dt>Pickup</dt><dd>{fmtDT(b.start_at)}</dd><dt>Passengers</dt><dd>{b.pax}</dd><dt>Vehicle</dt><dd>{b.vehicle_type}</dd><dt>Driver</dt><dd>{b.driver_name ? `${b.driver_name} (${b.driver_status || 'offered'})` : '—'}</dd></>}
            {b.notes && <><dt>Guest notes</dt><dd>{b.notes}</dd></>}
          </dl>
          <div class="small">Extras · දිය යුතු දේ: {extras.length ? extras.map((e) => `${e.name}${e.qty > 1 ? ' ×' + e.qty : ''}`).join(', ') : 'none'}</div>
        </div>

        <div class="stack">
          {b.kind === 'scooter' && (
            <div class="tiles">
              {docTile('passport', 'Passport · ගමන් බලපත්‍රය')}
              {docTile('licence', 'Licence · බලපත්‍රය')}
              {docTile('idp', 'IDP')}
              {docTile('permit', b.permit_option === 'arrange' ? 'AAC permit (we arrange)' : 'AAC / DMT permit', true)}
              <div class={`tile ${b.signed_at ? '' : 'bad'}`}>Agreement · ගිවිසුම<b>{b.signed_at ? `Signed ${fmtDT(b.signed_at)}` : 'Not signed'}</b></div>
            </div>
          )}
          <div class={`tile ${m.balance > 0 ? 'warn' : ''}`} style="padding:16px">
            To collect · මුදල් ලබා ගන්න
            <b style="font-size:22px">{m.balance > 0 ? lkr(m.balance) : 'Fully paid ✓'}</b>
            <span class="small">Total {lkr(m.due)} · paid {lkr(m.paid)}{b.deposit ? ` · deposit held ${lkr(m.depositHeld)} of ${lkr(b.deposit)}` : ''}</span>
          </div>
          {b.kind === 'scooter' && (!b.signed_at || docs.length < 3) && b.status !== 'cancelled' && (
            <div class="row">
              <a class="btn ghost" href={`/b/${b.token}/docs`}>Guest uploads documents on this tablet</a>
              {!b.signed_at && <a class="btn ghost" href={`/b/${b.token}/sign`}>Guest signs on this tablet</a>}
            </div>
          )}
        </div>
      </div>

      {docs.length > 0 && (
        <div class="card"><h2 style="font-size:18px">Documents</h2>
          <div class="photo-grid">{docs.map((d) => (<figure><a href={`/files/${d.r2_key}`} data-preview data-title={d.type}>{d.content_type === 'application/pdf' ? <div class="tile">PDF</div> : <img src={`/files/${d.r2_key}`} alt={d.type} loading="lazy" />}</a><figcaption>{d.type}</figcaption></figure>))}</div>
        </div>
      )}

      {exts.filter((x) => x.status === 'pending').map((x) => (
        <div class="card stack" style="border-color:var(--amber)">
          <b>Extension request: return {fmtDT(b.end_at)} → {fmtDT(x.new_end_at)} · {lkr(x.amount)}</b>
          <form method="post" action={`/staff/booking/${b.ref}/extension/${x.id}`} class="row">
            <label style="flex:0 1 180px">Amount (LKR)<input name="amount" type="number" value={String(x.amount)} min="0" /></label>
            <button class="btn green" name="action" value="approve">Approve</button>
            <button class="btn ghost" name="action" value="reject">Decline</button>
          </form>
        </div>
      ))}

      {b.status !== 'cancelled' && (
        <form class="card stack" method="post" action={`/staff/booking/${b.ref}/payment`} enctype="multipart/form-data">
          <h2 style="font-size:18px;margin:0">Record payment · ගෙවීම</h2>
          <div class="form-grid">
            <label>What for<select name="kind"><option value="rental">Booking payment</option>{b.deposit > 0 && <option value="deposit">Security deposit (held)</option>}<option value="charge">Damage / other charge</option><option value="extension">Extension</option></select></label>
            <label>Amount (LKR)<input name="amount" type="number" min="1" value={m.balance > 0 ? String(m.balance) : ''} required /></label>
            <label>Method<select name="method"><option value="cash">Cash · මුදල්</option><option value="card">Card (+{s.card_fee_pct || 0}% fee)</option><option value="bank">Bank transfer</option><option value="online">Paid online</option></select></label>
            <label>Bank slip (optional)<input type="file" name="slip" accept="image/*,application/pdf" /></label>
          </div>
          <div class="notice warn" data-card-hint data-pct={s.card_fee_pct || '0'} hidden>Card: swipe <b data-swipe></b> on the machine (<span data-base></span> + <span data-fee></span> service fee).
            <label class="check" style="margin-top:6px"><input type="checkbox" name="waive_fee" value="1" /> No card fee this time (Migga pays the bank fee)</label></div>
          <button class="btn dark">Save payment</button>
        </form>
      )}

      {b.kind === 'scooter' && b.status === 'confirmed' && (
        <form class="card stack" method="post" action={`/staff/booking/${b.ref}/pickup`} enctype="multipart/form-data">
          <h2 style="font-size:20px;margin:0">Pickup inspection · ඡායාරූප ගන්න</h2>
          {!b.signed_at && <div class="notice bad">The guest has not signed the agreement yet.</div>}
          {m.balance > 0 && <div class="notice warn">{lkr(m.balance)} still to collect.</div>}
          <div class="photo-grid">
            {ANGLES_PICKUP.map((a) => <CamInput name={`photo_${a}`} label={a} required />)}
          </div>
          <div class="form-grid">
            <label>Odometer (km)<input type="number" name="km" min="0" required /></label>
            <label>Fuel<select name="fuel">{FUEL.map((f) => <option selected={f === '½'}>{f}</option>)}</select></label>
            <label>Handed over<input name="items" value={['1 key', ...extras.map((e) => e.name)].join(', ')} /></label>
            <label>Existing marks / damage<input name="notes" placeholder="e.g. small scratch front panel" /></label>
          </div>
          <button class="btn big">Hand over scooter · ස්කූටරය දෙන්න</button>
        </form>
      )}

      {b.kind === 'scooter' && b.status === 'active' && (
        <form class="card stack" method="post" action={`/staff/booking/${b.ref}/return`} enctype="multipart/form-data">
          <h2 style="font-size:20px;margin:0">Return inspection · ආපසු පරීක්ෂාව</h2>
          {late.minutes > 0 && <div class={`notice ${late.amount ? 'bad' : 'warn'}`}>Returned {Math.round(late.minutes)} min late{late.amount ? ` · late fee ${lkr(late.amount)}` : ' (within grace period)'}</div>}
          <div class="photo-grid">
            {ANGLES_PICKUP.map((a) => {
              const p = pickupPhoto(a)
              return <CamInput name={`photo_${a}`} label={a} before={p ? `/files/${p.r2_key}` : undefined} />
            })}
          </div>
          <div class="form-grid">
            <label>Odometer (km){pickupInsp?.km != null && <span class="si">at pickup {pickupInsp.km}</span>}<input type="number" name="km" min="0" required /></label>
            <label>Fuel{pickupInsp?.fuel && <span class="si">at pickup {pickupInsp.fuel}</span>}<select name="fuel">{FUEL.map((f) => <option selected={f === pickupInsp?.fuel}>{f}</option>)}</select></label>
            <label>Notes<input name="notes" /></label>
          </div>
          <fieldset><legend>New damage · ගාස්තු</legend>
            {damage.map((d) => (<label class="check"><input type="checkbox" name="damage" value={String(d.id)} /> {d.name} <span class="muted small">{d.price ? lkr(d.price) : 'set price below'}</span></label>))}
            <div class="form-grid mt">
              <label>Other charge (description)<input name="other_desc" /></label>
              <label>Other charge (LKR)<input type="number" name="other_amount" min="0" /></label>
            </div>
          </fieldset>
          <label class="check"><input type="checkbox" name="apply_late" value="1" checked={late.amount > 0} /> Charge late fee {late.amount ? lkr(late.amount) : ''}</label>
          <label class="check"><input type="checkbox" name="fuel_short" value="1" /> Fuel lower than at pickup ({lkr(int(s.fuel_charge))})</label>
          <label>Refund deposit by<select name="refund_method"><option value="cash">Cash</option><option value="card">Card</option><option value="bank">Bank transfer</option></select></label>
          <button class="btn big">Close rental & email invoice</button>
        </form>
      )}

      {b.kind === 'taxi' && isAdmin && b.status !== 'cancelled' && b.status !== 'completed' && (
        <div class="card stack">
          <h2 style="font-size:18px;margin:0">Taxi: price & driver</h2>
          <form method="post" action={`/staff/booking/${b.ref}/taxi`} class="form-grid" style="align-items:end">
            <label>Trip price (LKR)<input name="price" type="number" min="0" value={String(b.total)} required /></label>
            <label>Migga commission (LKR)<input name="commission" type="number" min="0" value={String(b.commission)} required /></label>
            <label>Driver<select name="driver_id"><option value="">— choose —</option>{drivers.map((d) => <option value={String(d.id)} selected={d.id === b.driver_id}>{d.name} · {d.vehicle_type}</option>)}</select></label>
            <button class="btn dark">Save & offer to driver</button>
          </form>
          {driver && b.driver_status === 'offered' && (
            <a class="btn green" target="_blank" href={waLink(driver.phone, `Migga Taxi job ${b.ref}: ${b.pickup_location} → ${b.destination}, ${fmtDT(b.start_at)}, ${b.pax} pax, ${b.vehicle_type}. Price ${lkr(b.total)}, Migga commission ${lkr(b.commission)}. Accept here: ${env.SITE_URL}/d/${driver.token}`)}>Send job to {driver.name} on WhatsApp</a>
          )}
          {b.driver_status === 'accepted' && <form method="post" action={`/staff/booking/${b.ref}/taxi-done`}><button class="btn green">Mark trip done (adds commission to driver balance)</button></form>}
        </div>
      )}

      {b.kind === 'experience' && ['confirmed', 'active'].includes(b.status) && (
        <form method="post" action={`/staff/booking/${b.ref}/complete`}><button class="btn green">Mark as completed</button></form>
      )}

      {(charges.length > 0 || pays.length > 0) && (
        <div class="card scroll"><h2 style="font-size:18px">Money</h2>
          <table class="t"><thead><tr><th>Date</th><th>Item</th><th>Method</th><th>Amount</th></tr></thead><tbody>
            {charges.map((ch) => <tr><td>{ch.created_at.slice(0, 10)}</td><td>Charge: {ch.description}</td><td></td><td>{lkr(ch.amount)}</td></tr>)}
            {pays.map((p) => <tr><td>{p.paid_on}</td><td>{p.kind.replace('_', ' ')}{p.note ? ` · ${p.note}` : ''}{p.slip_key && <> · <a href={`/files/${p.slip_key}`} data-preview>slip</a></>}</td><td>{p.method}{p.staff ? ` · ${p.staff}` : ''}</td><td>{lkr(p.amount)}</td></tr>)}
          </tbody></table>
        </div>
      )}

      {insps.map((i) => (
        <div class="card"><h2 style="font-size:18px">{i.stage === 'pickup' ? 'Pickup' : 'Return'} inspection · {fmtDT(utcToLocal(env, i.created_at))} · {i.staff}</h2>
          <p class="small">Km {i.km ?? '—'} · Fuel {i.fuel} · {i.items} {i.notes && `· ${i.notes}`}</p>
          <div class="photo-grid">{photos.filter((p) => p.inspection_id === i.id).map((p) => <figure><a href={`/files/${p.r2_key}`} data-preview data-title={`${i.stage} · ${p.angle}`}><img src={`/files/${p.r2_key}`} alt={p.angle} loading="lazy" /></a><figcaption>{p.angle}</figcaption></figure>)}</div>
        </div>
      ))}

      <form class="card stack" method="post" action={`/staff/booking/${b.ref}/notes`}>
        <label>Staff notes (only staff see this)<textarea name="staff_notes">{b.staff_notes}</textarea></label>
        <div class="row"><button class="btn ghost">Save notes</button>
          {b.signed_at && <a href={`/b/${b.token}/agreement`} target="_blank">Signed agreement</a>}
          <a href={`/b/${b.token}`} target="_blank">Guest page</a>
        </div>
      </form>

      {isAdmin && !['cancelled', 'completed'].includes(b.status) && (
        <form method="post" action={`/staff/booking/${b.ref}/status`} class="row">
          {b.status === 'pending' && b.kind !== 'taxi' && <button class="btn ghost" name="status" value="confirmed">Confirm without signing online</button>}
          <button class="btn red" name="status" value="cancelled" onclick="return confirm('Cancel this booking?')">Cancel booking</button>
        </form>
      )}
    </AdminPage>,
  )
})

async function mustGet(c: any) {
  const b = await bookingByRef(c.env.DB, c.req.param('ref'))
  if (!b) throw new Error('not found')
  return b
}

app.post('/staff/booking/:ref/payment', async (c) => {
  const env = c.env, user = c.get('user')!
  const b = await mustGet(c)
  const f = await c.req.parseBody()
  const kind = ['rental', 'deposit', 'charge', 'extension'].includes(String(f.kind)) ? String(f.kind) : 'rental'
  const method = ['cash', 'card', 'bank', 'online'].includes(String(f.method)) ? String(f.method) : 'cash'
  const amount = int(f.amount)
  if (amount <= 0) return back(c, b.ref, 'Enter an amount.', 'error')
  let slip: string | null = null
  try { slip = (await putUpload(env.BUCKET, `bookings/${b.ref}`, f.slip))?.key ?? null } catch (e: any) { return back(c, b.ref, e.message, 'error') }
  const today = todayLocal(env), biz = businessOf(b.kind)
  const ops = [env.DB.prepare('INSERT INTO payments (booking_id, business, kind, method, amount, slip_key, staff_id, paid_on) VALUES (?,?,?,?,?,?,?,?)')
    .bind(b.id, biz, kind, method, amount, slip, user.id, today)]
  let fee = 0
  if (method === 'card') {
    // Guest pays the card service fee; the bank's cut is booked as an expense so profit stays correct.
    const pct = Number((await getSettings(env.DB)).card_fee_pct || 0)
    fee = f.waive_fee === '1' ? 0 : cardFee(amount, pct)
    const bankCut = Math.round(((amount + fee) * pct) / 100)
    if (fee > 0) {
      const desc = `Card service fee ${pct}% (on ${lkr(amount)})`
      ops.push(env.DB.prepare("INSERT INTO charges (booking_id, type, description, amount) VALUES (?, 'other', ?, ?)").bind(b.id, desc, fee))
      ops.push(env.DB.prepare("INSERT INTO payments (booking_id, business, kind, method, amount, note, staff_id, paid_on) VALUES (?,?, 'charge', 'card', ?, 'Card service fee', ?, ?)").bind(b.id, biz, fee, user.id, today))
    }
    if (bankCut > 0)
      ops.push(env.DB.prepare("INSERT INTO expenses (business, category, amount, spent_on, note, created_by) VALUES (?, 'Card bank fee', ?, ?, ?, ?)").bind(biz, bankCut, today, `${pct}% on card payment ${b.ref}`, user.id))
  }
  await env.DB.batch(ops)
  return back(c, b.ref, fee ? `Card: swipe ${lkr(amount + fee)} (${lkr(amount)} + ${lkr(fee)} service fee). Saved.` : `Saved ${lkr(amount)} (${method}).`)
})

async function savePhotos(env: Env, f: Record<string, any>, ref: string, inspectionId: number) {
  const stmts = []
  for (const a of ANGLES_PICKUP) {
    const up = await putUpload(env.BUCKET, `bookings/${ref}/inspection`, f[`photo_${a}`])
    if (up) stmts.push(env.DB.prepare('INSERT INTO inspection_photos (inspection_id, angle, r2_key) VALUES (?,?,?)').bind(inspectionId, a, up.key))
  }
  if (stmts.length) await env.DB.batch(stmts)
  return stmts.length
}

app.post('/staff/booking/:ref/pickup', async (c) => {
  const env = c.env, user = c.get('user')!
  const b = await mustGet(c)
  if (b.kind !== 'scooter' || b.status !== 'confirmed') return back(c, b.ref, 'This booking is not ready for pickup.', 'error')
  const f = await c.req.parseBody()
  const ins = await env.DB.prepare('INSERT INTO inspections (booking_id, stage, km, fuel, items, notes, staff_id) VALUES (?,?,?,?,?,?,?) RETURNING id')
    .bind(b.id, 'pickup', int(f.km), str(f.fuel, 10), str(f.items, 300), str(f.notes, 500), user.id).first<{ id: number }>()
  let n = 0
  try { n = await savePhotos(env, f, b.ref, ins!.id) } catch (e: any) { return back(c, b.ref, e.message, 'error') }
  await env.DB.prepare("UPDATE bookings SET status='active' WHERE id=?").bind(b.id).run()
  later(c, sendMail(env, b.email, `Pickup receipt · ${b.ref}`, pickupEmail(env, b, { km: int(f.km), fuel: str(f.fuel, 10), items: str(f.items, 300), notes: str(f.notes, 500) }, n)))
  return back(c, b.ref, 'Scooter handed over. Pickup receipt emailed to the guest.')
})

app.post('/staff/booking/:ref/return', async (c) => {
  const env = c.env, user = c.get('user')!
  const b = await mustGet(c)
  if (b.kind !== 'scooter' || b.status !== 'active') return back(c, b.ref, 'This scooter is not out.', 'error')
  const f = await c.req.parseBody({ all: true })
  const s = await getSettings(env.DB)
  const now = nowLocal(env)
  const v = await env.DB.prepare('SELECT rate_day FROM vehicles WHERE id=?').bind(b.vehicle_id).first<{ rate_day: number }>()
  const ins = await env.DB.prepare('INSERT INTO inspections (booking_id, stage, km, fuel, notes, staff_id) VALUES (?,?,?,?,?,?) RETURNING id')
    .bind(b.id, 'return', int(f.km), str(f.fuel, 10), str(f.notes, 500), user.id).first<{ id: number }>()
  try { await savePhotos(env, f as any, b.ref, ins!.id) } catch (e: any) { return back(c, b.ref, e.message, 'error') }
  const charges: { type: string; description: string; amount: number }[] = []
  const ids = (Array.isArray(f.damage) ? f.damage : f.damage ? [f.damage] : []).map((x) => int(x))
  if (ids.length) {
    const { results } = await env.DB.prepare(`SELECT name, price FROM damage_items WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<any>()
    for (const d of results) if (d.price > 0) charges.push({ type: 'damage', description: d.name, amount: d.price })
  }
  if (int(f.other_amount) > 0) charges.push({ type: 'other', description: str(f.other_desc, 200) || 'Other', amount: int(f.other_amount) })
  if (f.apply_late === '1') {
    const late = lateCharge(b, now, s, v?.rate_day || 0)
    if (late.amount) charges.push({ type: 'late', description: `Late return (${Math.round(late.minutes)} min)`, amount: late.amount })
  }
  if (f.fuel_short === '1' && int(s.fuel_charge)) charges.push({ type: 'fuel', description: 'Fuel shortfall', amount: int(s.fuel_charge) })
  if (charges.length) await env.DB.batch(charges.map((ch) => env.DB.prepare('INSERT INTO charges (booking_id, type, description, amount) VALUES (?,?,?,?)').bind(b.id, ch.type, ch.description, ch.amount)))
  // Settle against the deposit: unpaid charges come out of the deposit first, the rest is refunded.
  const m = await moneySummary(env.DB, b)
  const method = ['cash', 'card', 'bank'].includes(String(f.refund_method)) ? String(f.refund_method) : 'cash'
  const fromDeposit = Math.max(0, Math.min(m.balance, m.depositHeld))
  const refund = m.depositHeld - fromDeposit
  const today = todayLocal(env)
  const ops = []
  if (fromDeposit > 0) {
    ops.push(env.DB.prepare("INSERT INTO payments (booking_id, business, kind, method, amount, note, staff_id, paid_on) VALUES (?, 'scooter', 'deposit_refund', 'cash', ?, 'Kept from deposit for charges', ?, ?)").bind(b.id, -fromDeposit, user.id, today))
    ops.push(env.DB.prepare("INSERT INTO payments (booking_id, business, kind, method, amount, note, staff_id, paid_on) VALUES (?, 'scooter', 'charge', 'cash', ?, 'Paid from deposit', ?, ?)").bind(b.id, fromDeposit, user.id, today))
  }
  if (refund > 0) ops.push(env.DB.prepare("INSERT INTO payments (booking_id, business, kind, method, amount, note, staff_id, paid_on) VALUES (?, 'scooter', 'deposit_refund', ?, ?, 'Deposit refunded', ?, ?)").bind(b.id, method, -refund, user.id, today))
  ops.push(env.DB.prepare("UPDATE bookings SET status='completed', actual_return_at=? WHERE id=?").bind(now, b.id))
  await env.DB.batch(ops)
  const nb = (await bookingByRef(env.DB, b.ref))!
  const m2 = await moneySummary(env.DB, nb)
  later(c, sendMail(env, b.email, `Rental closed · invoice ${b.ref}`, returnEmail(env, nb, charges, m2, refund)))
  const left = m2.balance > 0 ? ` Still to collect: ${lkr(m2.balance)}.` : ''
  return back(c, b.ref, `Rental closed. Refund ${lkr(refund)} to the guest.${left}`, m2.balance > 0 ? 'error' : 'ok')
})

app.post('/staff/booking/:ref/extension/:id', async (c) => {
  const env = c.env
  const b = await mustGet(c)
  const x = await env.DB.prepare("SELECT * FROM extensions WHERE id=? AND booking_id=? AND status='pending'").bind(int(c.req.param('id')), b.id).first<any>()
  if (!x) return back(c, b.ref, 'Request not found.', 'error')
  const f = await c.req.parseBody()
  if (f.action === 'approve') {
    if (!(await vehicleIsFree(env.DB, b.vehicle_id!, b.end_at!, x.new_end_at, b.id))) return back(c, b.ref, 'The scooter is booked by someone else in that time.', 'error')
    const amount = Math.max(0, int(f.amount, x.amount))
    await env.DB.batch([
      env.DB.prepare("UPDATE extensions SET status='approved', amount=? WHERE id=?").bind(amount, x.id),
      env.DB.prepare('UPDATE bookings SET end_at=?, total = total + ?, rental_price = rental_price + ? WHERE id=?').bind(x.new_end_at, amount, amount, b.id),
    ])
    later(c, sendMail(env, b.email, `Extension approved · ${b.ref}`, extensionEmail(env, b, x.new_end_at, amount, true)))
    return back(c, b.ref, 'Extension approved and emailed.')
  }
  await env.DB.prepare("UPDATE extensions SET status='rejected' WHERE id=?").bind(x.id).run()
  return back(c, b.ref, 'Extension declined. Please message the guest.')
})

app.post('/staff/booking/:ref/notes', async (c) => {
  const b = await mustGet(c)
  const f = await c.req.parseBody()
  await c.env.DB.prepare('UPDATE bookings SET staff_notes=? WHERE id=?').bind(str(f.staff_notes, 3000), b.id).run()
  return back(c, b.ref, 'Notes saved.')
})

app.post('/staff/booking/:ref/complete', async (c) => {
  const b = await mustGet(c)
  await c.env.DB.prepare("UPDATE bookings SET status='completed', actual_return_at=? WHERE id=?").bind(nowLocal(c.env), b.id).run()
  return back(c, b.ref, 'Marked as completed.')
})

app.post('/staff/booking/:ref/status', async (c) => {
  if (c.get('user')!.role !== 'admin') return c.text('Admins only', 403)
  const b = await mustGet(c)
  const f = await c.req.parseBody()
  const st = String(f.status)
  if (!['confirmed', 'cancelled'].includes(st)) return back(c, b.ref, 'Unknown status', 'error')
  await c.env.DB.prepare('UPDATE bookings SET status=? WHERE id=?').bind(st, b.id).run()
  return back(c, b.ref, st === 'cancelled' ? 'Booking cancelled.' : 'Booking confirmed.')
})

app.post('/staff/booking/:ref/taxi', async (c) => {
  if (c.get('user')!.role !== 'admin') return c.text('Admins only', 403)
  const env = c.env
  const b = await mustGet(c)
  const f = await c.req.parseBody()
  const driverId = int(f.driver_id) || null
  const price = int(f.price), commission = int(f.commission)
  const changedDriver = driverId !== b.driver_id
  await env.DB.prepare(`UPDATE bookings SET rental_price=?1, total=?1, commission=?2, driver_id=?3,
    driver_status=CASE WHEN ?5 = 1 THEN (CASE WHEN ?3 IS NULL THEN '' ELSE 'offered' END) ELSE driver_status END WHERE id=?4`)
    .bind(price, commission, driverId, b.id, changedDriver ? 1 : 0).run()
  return back(c, b.ref, driverId ? 'Saved. Now send the job to the driver on WhatsApp.' : 'Saved.')
})

app.post('/staff/booking/:ref/taxi-done', async (c) => {
  if (c.get('user')!.role !== 'admin') return c.text('Admins only', 403)
  const b = await mustGet(c)
  await completeTaxi(c.env, b)
  return back(c, b.ref, 'Trip done. Commission added to the driver balance.')
})

/** Shared by admin and the driver portal. Idempotent. */
export async function completeTaxi(env: Env, b: Booking) {
  if (b.status === 'completed' || !b.driver_id) return
  await env.DB.batch([
    env.DB.prepare("UPDATE bookings SET status='completed', driver_status='done', actual_return_at=? WHERE id=?").bind(nowLocal(env), b.id),
    env.DB.prepare("INSERT INTO driver_ledger (driver_id, booking_id, amount, note) VALUES (?,?,?,?)").bind(b.driver_id, b.id, b.commission, `Commission ${b.ref} → ${b.destination}`),
  ])
}

export async function notifyTaxiConfirmed(c: any, env: Env, ref: string) {
  const nb = await bookingByRef(env.DB, ref)
  if (nb) later(c, sendMail(env, nb.email, `Driver confirmed · ${nb.ref}`, taxiEmail(env, nb, 'confirmed')))
}

export default app

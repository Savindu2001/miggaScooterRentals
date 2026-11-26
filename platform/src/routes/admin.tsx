import { Hono } from 'hono'
import type { AppEnv } from '../lib/env'
import { AdminPage, Flash } from '../views/layout'
import { hashPassword, requireAdmin } from '../lib/auth'
import { KIND_LABEL, STATUS_LABEL } from '../lib/bookings'
import { fmtDT, getSettings, int, isEmail, lkr, normDate, nowLocal, str, todayLocal, waLink } from '../lib/util'
import { putUpload } from '../lib/files'
import { rentalDays } from '../lib/pricing'
import { driverBalance } from './driver'

const app = new Hono<AppEnv>()
app.use('/admin', requireAdmin)
app.use('/admin/*', requireAdmin)

const ok = (c: any, path: string, msg: string) => c.redirect(`${path}${path.includes('?') ? '&' : '?'}ok=${encodeURIComponent(msg)}`)
const errTo = (c: any, path: string, msg: string) => c.redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`)
const Msgs = (p: { c: any }) => <><Flash msg={p.c.req.query('ok')} /><Flash msg={p.c.req.query('error')} kind="bad" /></>
const nullInt = (v: unknown) => (String(v ?? '').trim() === '' ? null : int(v))

// ---------------- Dashboard ----------------
app.get('/admin', async (c) => {
  const env = c.env, user = c.get('user')!
  const month = todayLocal(env).slice(0, 7)
  const now = nowLocal(env)
  const [inc, exp, out, ext, taxi, unsigned, slips, drivers, today] = await Promise.all([
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE kind NOT IN ('deposit','deposit_refund') AND substr(paid_on,1,7)=?").bind(month).first<{ s: number }>(),
    env.DB.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE substr(spent_on,1,7)=?').bind(month).first<{ s: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM bookings WHERE kind='scooter' AND status='active'").first<{ n: number }>(),
    env.DB.prepare("SELECT x.*, b.ref, b.guest_name FROM extensions x JOIN bookings b ON b.id=x.booking_id WHERE x.status='pending'").all<any>(),
    env.DB.prepare("SELECT ref, guest_name, destination, start_at, total, driver_status FROM bookings WHERE kind='taxi' AND status='pending' ORDER BY start_at").all<any>(),
    env.DB.prepare("SELECT ref, guest_name, start_at FROM bookings WHERE kind='scooter' AND status='pending' AND created_at > datetime('now','-3 days') ORDER BY start_at").all<any>(),
    env.DB.prepare("SELECT l.*, d.name FROM driver_ledger l JOIN drivers d ON d.id=l.driver_id WHERE l.status='pending'").all<any>(),
    env.DB.prepare("SELECT id, name FROM drivers WHERE status='pending'").all<any>(),
    env.DB.prepare(`SELECT b.ref, b.kind, b.guest_name, b.start_at, b.end_at, b.status, v.name AS vehicle_name, e.name AS experience_name, b.destination FROM bookings b
      LEFT JOIN vehicles v ON v.id=b.vehicle_id LEFT JOIN experiences e ON e.id=b.experience_id
      WHERE b.status IN ('confirmed','active','pending') AND (substr(b.start_at,1,10)=?1 OR (b.status='active' AND substr(b.end_at,1,10)<=?1)) ORDER BY b.start_at`).bind(todayLocal(env)).all<any>(),
  ])
  const owed = (await env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM driver_ledger WHERE status='confirmed'").first<{ s: number }>())?.s ?? 0
  const vcount = (await env.DB.prepare("SELECT COUNT(*) AS n FROM vehicles WHERE status='active'").first<{ n: number }>())?.n ?? 0
  return c.html(
    <AdminPage env={env} user={user} path="/admin" title="Dashboard">
      <div class="row between"><h1 style="font-size:28px;margin:0">Dashboard</h1><a class="btn dark" href="/admin/finance">+ Add expense</a></div>
      <div class="tiles">
        <div class="stat">Income this month<b>{lkr(inc?.s)}</b></div>
        <div class="stat">Expenses this month<b>{lkr(exp?.s)}</b></div>
        <div class="stat">Scooters out now<b>{out?.n} of {vcount}</b></div>
        <div class="stat" style="background:var(--warm)">Drivers owe you<b>{lkr(owed)}</b></div>
      </div>
      <div class="grid" style="align-items:start">
        <div class="card scroll"><h2 style="font-size:18px">Today</h2>
          <table class="t"><tbody>
            {today.results.map((b) => <tr><td>{(b.status === 'active' ? b.end_at : b.start_at).slice(11)}</td><td>{KIND_LABEL[b.kind]}</td><td><a href={`/staff/booking/${b.ref}`}>{b.guest_name}</a></td><td>{b.vehicle_name || b.experience_name || b.destination}</td><td>{b.status === 'active' ? 'Return' : STATUS_LABEL[b.status]}</td></tr>)}
            {!today.results.length && <tr><td class="muted">Nothing today.</td></tr>}
          </tbody></table>
        </div>
        <div class="card stack"><h2 style="font-size:18px;margin:0">Needs you</h2>
          {ext.results.map((x) => <a href={`/staff/booking/${x.ref}`}>Extension: {x.guest_name} → {fmtDT(x.new_end_at)}</a>)}
          {taxi.results.map((t) => <a href={`/staff/booking/${t.ref}`}>Taxi {t.ref}: {t.destination}, {fmtDT(t.start_at)} · {!t.total ? 'needs price' : t.driver_status === 'offered' ? 'waiting for driver' : 'needs driver'}</a>)}
          {slips.results.map((l) => <a href="/admin/taxi">Driver payment to confirm: {l.name} {lkr(-l.amount)}</a>)}
          {drivers.results.map((d) => <a href="/admin/taxi">New driver to approve: {d.name}</a>)}
          {unsigned.results.map((u) => <a href={`/staff/booking/${u.ref}`}>Unfinished scooter booking: {u.guest_name} ({fmtDT(u.start_at)})</a>)}
          {!(ext.results.length + taxi.results.length + slips.results.length + drivers.results.length + unsigned.results.length) && <span class="muted">All clear.</span>}
        </div>
      </div>
    </AdminPage>,
  )
})

// ---------------- Bookings ----------------
app.get('/admin/bookings', async (c) => {
  const env = c.env, user = c.get('user')!
  const q = c.req.query()
  const where: string[] = ['1=1'], args: unknown[] = []
  if (q.kind) { where.push('b.kind = ?'); args.push(q.kind) }
  if (q.status) { where.push('b.status = ?'); args.push(q.status) }
  if (q.from) { where.push('substr(b.start_at,1,10) >= ?'); args.push(normDate(q.from)) }
  if (q.q) { where.push('(b.guest_name LIKE ? OR b.ref LIKE ? OR b.phone LIKE ? OR b.email LIKE ?)'); const l = `%${str(q.q, 60)}%`; args.push(l, l, l, l) }
  const { results } = await env.DB.prepare(`SELECT b.*, v.name AS vehicle_name, e.name AS experience_name FROM bookings b LEFT JOIN vehicles v ON v.id=b.vehicle_id
    LEFT JOIN experiences e ON e.id=b.experience_id WHERE ${where.join(' AND ')} ORDER BY b.start_at DESC LIMIT 200`).bind(...args).all<any>()
  return c.html(
    <AdminPage env={env} user={user} path="/admin/bookings" title="Bookings">
      <h1 style="font-size:28px;margin:0">Bookings</h1>
      <form class="row" method="get">
        <input name="q" value={q.q || ''} placeholder="Name, ref, phone, email" style="flex:1 1 200px" />
        <select name="kind" style="flex:0 1 160px"><option value="">All types</option>{Object.entries(KIND_LABEL).map(([k, l]) => <option value={k} selected={q.kind === k}>{l}</option>)}</select>
        <select name="status" style="flex:0 1 160px"><option value="">All statuses</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option value={k} selected={q.status === k}>{l}</option>)}</select>
        <input type="date" name="from" value={q.from || ''} style="flex:0 1 170px" aria-label="From date" />
        <button class="btn dark">Filter</button>
      </form>
      <div class="card scroll"><table class="t">
        <thead><tr><th>Ref</th><th>Start</th><th>Type</th><th>Guest</th><th>What</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>{results.map((b) => (
          <tr><td><a href={`/staff/booking/${b.ref}`}>{b.ref}</a></td><td>{fmtDT(b.start_at)}</td><td>{KIND_LABEL[b.kind]}</td><td>{b.guest_name}<br /><span class="tiny muted">{b.phone}</span></td>
            <td>{b.vehicle_name || b.experience_name || `→ ${b.destination}`}</td><td>{b.total ? lkr(b.total) : '—'}</td><td><span class="badge">{STATUS_LABEL[b.status]}</span></td></tr>
        ))}</tbody>
      </table></div>
    </AdminPage>,
  )
})

// ---------------- Scooters ----------------
app.get('/admin/vehicles', async (c) => {
  const env = c.env, user = c.get('user')!
  const { results } = await env.DB.prepare('SELECT * FROM vehicles ORDER BY sort, id').all<any>()
  const editId = int(c.req.query('edit'))
  const v = results.find((x) => x.id === editId) || {}
  return c.html(
    <AdminPage env={env} user={user} path="/admin/vehicles" title="Scooters">
      <h1 style="font-size:28px;margin:0">Scooters & partner bikes</h1>
      <Msgs c={c} />
      <div class="card scroll"><table class="t">
        <thead><tr><th>Scooter</th><th>Plate</th><th>Day</th><th>3 days</th><th>Week</th><th>Month</th><th>Deposit</th><th>Owner</th><th>Status</th><th></th></tr></thead>
        <tbody>{results.map((x) => <tr><td>{x.name}</td><td>{x.plate}</td><td>{x.rate_day}</td><td>{x.rate_3day ?? '—'}</td><td>{x.rate_week ?? '—'}</td><td>{x.rate_month ?? '—'}</td><td>{x.deposit}</td><td>{x.owner_name ? `${x.owner_name} (${x.owner_rate_day}/day)` : 'Migga'}</td><td>{x.status}</td><td><a href={`/admin/vehicles?edit=${x.id}`}>Edit</a></td></tr>)}</tbody>
      </table></div>
      <form class="card stack" method="post" action="/admin/vehicles" enctype="multipart/form-data">
        <h2 style="font-size:20px;margin:0">{v.id ? `Edit ${v.name}` : 'Add a scooter'}</h2>
        <input type="hidden" name="id" value={v.id ? String(v.id) : ''} />
        <div class="form-grid">
          <label>Name / model<input name="name" value={v.name || ''} required /></label>
          <label>Plate<input name="plate" value={v.plate || ''} required /></label>
          <label>Price 1 day (LKR)<input type="number" name="rate_day" value={v.rate_day ?? ''} required min="0" /></label>
          <label>Price 3 days total<input type="number" name="rate_3day" value={v.rate_3day ?? ''} min="0" placeholder="empty = 3 × day" /></label>
          <label>Price week total<input type="number" name="rate_week" value={v.rate_week ?? ''} min="0" /></label>
          <label>Price month total<input type="number" name="rate_month" value={v.rate_month ?? ''} min="0" /></label>
          <label>Security deposit<input type="number" name="deposit" value={v.deposit ?? 0} min="0" /></label>
          <label>Status<select name="status">{['active', 'maintenance', 'retired'].map((s) => <option selected={v.status === s}>{s}</option>)}</select></label>
          <label>Partner owner (empty = Migga)<input name="owner_name" value={v.owner_name || ''} /></label>
          <label>Owner gets per day (LKR)<input type="number" name="owner_rate_day" value={v.owner_rate_day ?? ''} min="0" /></label>
          <label>Sort order<input type="number" name="sort" value={v.sort ?? 0} /></label>
          <label>Photo<input type="file" name="photo_file" accept="image/*" /></label>
        </div>
        <label>Description<input name="description" value={v.description || ''} /></label>
        <div class="row"><button class="btn dark">Save</button>{v.id && <a href="/admin/vehicles">Cancel</a>}</div>
      </form>
    </AdminPage>,
  )
})

app.post('/admin/vehicles', async (c) => {
  const env = c.env
  const f = await c.req.parseBody()
  const id = int(f.id)
  let photo: string | null = null
  try { const up = await putUpload(env.BUCKET, 'public/vehicles', f.photo_file); if (up) photo = '/media/' + up.key } catch (e: any) { return errTo(c, '/admin/vehicles', e.message) }
  const vals = [str(f.name, 80), str(f.plate, 20).toUpperCase(), str(f.description, 200), int(f.rate_day), nullInt(f.rate_3day), nullInt(f.rate_week), nullInt(f.rate_month),
    int(f.deposit), str(f.owner_name, 80) || null, nullInt(f.owner_rate_day), ['active', 'maintenance', 'retired'].includes(String(f.status)) ? String(f.status) : 'active', int(f.sort)]
  if (!vals[0] || !vals[1] || !vals[3]) return errTo(c, '/admin/vehicles', 'Name, plate and day price are required.')
  try {
    if (id) {
      await env.DB.prepare('UPDATE vehicles SET name=?, plate=?, description=?, rate_day=?, rate_3day=?, rate_week=?, rate_month=?, deposit=?, owner_name=?, owner_rate_day=?, status=?, sort=? WHERE id=?').bind(...vals, id).run()
      if (photo) await env.DB.prepare('UPDATE vehicles SET photo=? WHERE id=?').bind(photo, id).run()
    } else {
      await env.DB.prepare('INSERT INTO vehicles (name, plate, description, rate_day, rate_3day, rate_week, rate_month, deposit, owner_name, owner_rate_day, status, sort, photo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...vals, photo || '').run()
    }
  } catch { return errTo(c, '/admin/vehicles', 'That plate number already exists.') }
  return ok(c, '/admin/vehicles', 'Saved.')
})

// ---------------- Experiences ----------------
app.get('/admin/experiences', async (c) => {
  const env = c.env, user = c.get('user')!
  const { results } = await env.DB.prepare('SELECT * FROM experiences ORDER BY sort, id').all<any>()
  const e = results.find((x) => x.id === int(c.req.query('edit'))) || {}
  return c.html(
    <AdminPage env={env} user={user} path="/admin/experiences" title="Safari & tours">
      <h1 style="font-size:28px;margin:0">Safaris, tours & activities</h1>
      <Msgs c={c} />
      <div class="card scroll"><table class="t">
        <thead><tr><th>Name</th><th>Type</th><th>Price</th><th>Your cost</th><th>Times</th><th>Per slot</th><th>Active</th><th></th></tr></thead>
        <tbody>{results.map((x) => <tr><td><a href={`/experiences/${x.slug}`} target="_blank">{x.name}</a></td><td>{x.category}</td><td>{lkr(x.price)} / {x.price_per}</td><td>{lkr(x.cost)}</td><td>{x.slots}</td><td>{x.capacity}</td><td>{x.active ? 'yes' : 'no'}</td><td><a href={`/admin/experiences?edit=${x.id}`}>Edit</a></td></tr>)}</tbody>
      </table></div>
      <form class="card stack" method="post" action="/admin/experiences" enctype="multipart/form-data">
        <h2 style="font-size:20px;margin:0">{e.id ? `Edit ${e.name}` : 'Add an experience'}</h2>
        <input type="hidden" name="id" value={e.id ? String(e.id) : ''} />
        <div class="form-grid">
          <label>Name<input name="name" value={e.name || ''} required /></label>
          <label>Web address (slug)<input name="slug" value={e.slug || ''} placeholder="minneriya-jeep-safari" required pattern="[a-z0-9-]+" /></label>
          <label>Type<select name="category">{['safari', 'tour', 'activity'].map((x) => <option selected={e.category === x}>{x}</option>)}</select></label>
          <label>Price (LKR, 0 = on request)<input type="number" name="price" value={e.price ?? 0} min="0" /></label>
          <label>Price is per<select name="price_per"><option value="group" selected={e.price_per === 'group'}>jeep / group</option><option value="person" selected={e.price_per === 'person'}>person</option></select></label>
          <label>Max people<input type="number" name="max_pax" value={e.max_pax ?? 6} min="1" /></label>
          <label>Your cost (jeep / guide)<input type="number" name="cost" value={e.cost ?? 0} min="0" /></label>
          <label>Start times (comma separated)<input name="slots" value={e.slots || '06:00,14:00'} /></label>
          <label>Bookings per time slot<input type="number" name="capacity" value={e.capacity ?? 3} min="1" /></label>
          <label>Sort order<input type="number" name="sort" value={e.sort ?? 0} /></label>
          <label>Photo<input type="file" name="photo_file" accept="image/*" /></label>
          <label class="check"><input type="checkbox" name="active" value="1" checked={e.id ? !!e.active : true} /> Show on website</label>
        </div>
        <label>Short summary<input name="summary" value={e.summary || ''} maxlength={200} /></label>
        <label>Description<textarea name="description">{e.description || ''}</textarea></label>
        <label>Duration (e.g. About 3–4 hours)<input name="duration" value={e.duration || ''} maxlength={60} /></label>
        <label>Highlights (one per line)<textarea name="highlights">{e.highlights || ''}</textarea></label>
        <label>Best time to go<textarea name="best_time" style="min-height:70px">{e.best_time || ''}</textarea></label>
        <label>How the day goes (one step per line: Step | details)<textarea name="itinerary">{e.itinerary || ''}</textarea></label>
        <div class="form-grid">
          <label>Included (one per line, e.g. free breakfast pack)<textarea name="includes">{e.includes || ''}</textarea></label>
          <label>Not included (one per line)<textarea name="excludes">{e.excludes || ''}</textarea></label>
          <label>What to bring (one per line)<textarea name="bring">{e.bring || ''}</textarea></label>
        </div>
        <label>Questions (one per line: Question? | Answer)<textarea name="faq">{e.faq || ''}</textarea></label>
        <label>Photo gallery (one per line: image link | photo credit)<textarea name="gallery">{e.gallery || ''}</textarea></label>
        <div class="form-grid">
          <label>Add gallery photos<input type="file" name="gallery_files" accept="image/*" multiple /></label>
          <label>Credit for new photos (optional)<input name="gallery_credit" placeholder="e.g. Photo: Migga" /></label>
        </div>
        <div class="row"><button class="btn dark">Save</button>{e.id && <a href="/admin/experiences">Cancel</a>}</div>
      </form>
    </AdminPage>,
  )
})

app.post('/admin/experiences', async (c) => {
  const env = c.env
  const f = await c.req.parseBody({ all: true }) as Record<string, any>
  const id = int(f.id)
  const slug = str(f.slug, 80).toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const slots = str(f.slots, 100).split(',').map((s) => s.trim()).filter((s) => /^\d{2}:\d{2}$/.test(s)).join(',') || '06:00'
  let photo: string | null = null
  try { const up = await putUpload(env.BUCKET, 'public/experiences', f.photo_file); if (up) photo = '/media/' + up.key } catch (e: any) { return errTo(c, '/admin/experiences', e.message) }
  let gallery = String(f.gallery || '').replace(/\r\n/g, '\n').trim()
  try {
    for (const file of Array.isArray(f.gallery_files) ? f.gallery_files : [f.gallery_files]) {
      const up = await putUpload(env.BUCKET, 'public/experiences', file)
      if (up) gallery += `${gallery ? '\n' : ''}/media/${up.key}${str(f.gallery_credit, 120) ? ' | ' + str(f.gallery_credit, 120) : ''}`
    }
  } catch (e: any) { return errTo(c, '/admin/experiences', e.message) }
  const details = [str(f.duration, 60), str(f.highlights, 3000), str(f.best_time, 2000), str(f.itinerary, 3000), str(f.excludes, 2000), str(f.bring, 2000), str(f.faq, 6000), gallery.slice(0, 6000)]
  const vals = [slug, str(f.name, 120), ['safari', 'tour', 'activity'].includes(String(f.category)) ? String(f.category) : 'tour', str(f.summary, 200), str(f.description, 4000), str(f.includes, 2000),
    int(f.price), String(f.price_per) === 'person' ? 'person' : 'group', Math.max(1, int(f.max_pax, 6)), int(f.cost), slots, Math.max(1, int(f.capacity, 3)), f.active === '1' ? 1 : 0, int(f.sort)]
  if (!vals[0] || !vals[1]) return errTo(c, '/admin/experiences', 'Name and slug are required.')
  try {
    if (id) {
      await env.DB.prepare('UPDATE experiences SET slug=?, name=?, category=?, summary=?, description=?, includes=?, price=?, price_per=?, max_pax=?, cost=?, slots=?, capacity=?, active=?, sort=?, duration=?, highlights=?, best_time=?, itinerary=?, excludes=?, bring=?, faq=?, gallery=? WHERE id=?').bind(...vals, ...details, id).run()
      if (photo) await env.DB.prepare('UPDATE experiences SET photo=? WHERE id=?').bind(photo, id).run()
    } else await env.DB.prepare('INSERT INTO experiences (slug, name, category, summary, description, includes, price, price_per, max_pax, cost, slots, capacity, active, sort, photo, duration, highlights, best_time, itinerary, excludes, bring, faq, gallery) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...vals, photo || '', ...details).run()
  } catch { return errTo(c, '/admin/experiences', 'That web address (slug) is already used.') }
  return ok(c, '/admin/experiences', 'Saved.')
})

// ---------------- Taxi ----------------
app.get('/admin/taxi', async (c) => {
  const env = c.env, user = c.get('user')!
  const [routes, drivers, pending, s] = await Promise.all([
    env.DB.prepare('SELECT * FROM taxi_routes ORDER BY sort, id').all<any>(),
    env.DB.prepare('SELECT * FROM drivers ORDER BY status, name').all<any>(),
    env.DB.prepare("SELECT l.*, d.name FROM driver_ledger l JOIN drivers d ON d.id=l.driver_id WHERE l.status='pending' ORDER BY l.id").all<any>(),
    getSettings(env.DB),
  ])
  const balances = await Promise.all(drivers.results.map((d) => driverBalance(env.DB, d.id)))
  return c.html(
    <AdminPage env={env} user={user} path="/admin/taxi" title="Taxi">
      <h1 style="font-size:28px;margin:0">Taxi & drivers</h1>
      <Msgs c={c} />
      {pending.results.length > 0 && (
        <div class="card stack"><h2 style="font-size:18px;margin:0">Driver payments to confirm</h2>
          {pending.results.map((l) => (
            <form method="post" action={`/admin/taxi/ledger/${l.id}`} class="row">
              <span style="flex:1">{l.name} paid <b>{lkr(-l.amount)}</b> {l.slip_key && <a href={`/files/${l.slip_key}`} data-preview>slip</a>}</span>
              <button class="btn green sm" name="action" value="confirm">Confirm</button><button class="btn ghost sm" name="action" value="reject">Reject</button>
            </form>
          ))}
        </div>
      )}
      <div class="card scroll"><h2 style="font-size:18px">Drivers</h2>
        <table class="t"><thead><tr><th>Name</th><th>Vehicle</th><th>NIC / licence</th><th>Owes Migga</th><th>Status</th><th></th></tr></thead>
          <tbody>{drivers.results.map((d, i) => (
            <tr><td>{d.name}<br /><a class="tiny" href={waLink(d.phone)}>{d.phone}</a></td><td>{d.vehicle_type} · {d.vehicle_no} {d.vehicle_model}</td><td class="small">{d.nic}<br />{d.licence_no}</td>
              <td><b>{lkr(balances[i])}</b></td><td><span class={`badge ${d.status === 'approved' ? 'ok' : d.status === 'pending' ? 'warn' : 'bad'}`}>{d.status}</span></td>
              <td><form method="post" action={`/admin/taxi/driver/${d.id}`} class="row" style="gap:6px">
                {d.status !== 'approved' && <button class="btn green sm" name="status" value="approved">Approve</button>}
                {d.status !== 'blocked' && <button class="btn ghost sm" name="status" value="blocked">Block</button>}
                {d.status === 'approved' && <a class="btn ghost sm" target="_blank" href={`/d/${d.token}`}>Driver page</a>}
                {d.status === 'approved' && <a class="btn ghost sm" target="_blank" href={waLink(d.phone, `Hi ${d.name}, your Migga Taxi driver page: ${env.SITE_URL}/d/${d.token}`)}>Send link</a>}
              </form></td></tr>
          ))}</tbody></table>
        <p class="small muted">New drivers register at <a href="/drivers/join">{env.SITE_URL}/drivers/join</a>.</p>
      </div>
      <form class="card stack" method="post" action="/admin/taxi/settings">
        <h2 style="font-size:18px;margin:0">Price formula (used when a route has no fixed price)</h2>
        <div class="form-grid">
          <label>Car: LKR per km<input type="number" name="taxi_rate_km_car" value={s.taxi_rate_km_car} min="0" /></label>
          <label>Van: LKR per km<input type="number" name="taxi_rate_km_van" value={s.taxi_rate_km_van} min="0" /></label>
          <label>Minimum fare<input type="number" name="taxi_min_fare" value={s.taxi_min_fare} min="0" /></label>
          <label>Migga commission %<input type="number" name="taxi_commission_pct" value={s.taxi_commission_pct} min="0" max="100" /></label>
        </div>
        <p class="small muted" style="margin:0">Price = max(minimum fare, km × rate), rounded up to the next LKR 500.</p>
        <button class="btn dark">Save formula</button>
      </form>
      <div class="card scroll"><h2 style="font-size:18px">Fixed route prices from Sigiriya</h2>
        <table class="t"><thead><tr><th>Destination</th><th>km</th><th>Car</th><th>Van</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {routes.results.map((r) => (
              <tr><td colspan={6}><form method="post" action="/admin/taxi/route" class="row" style="gap:8px">
                <input type="hidden" name="id" value={String(r.id)} />
                <input name="destination" value={r.destination} style="flex:2 1 200px" />
                <input type="number" name="km" value={r.km} style="flex:0 1 90px" aria-label="km" />
                <input type="number" name="price_car" value={r.price_car} style="flex:0 1 120px" aria-label="Car price" />
                <input type="number" name="price_van" value={r.price_van} style="flex:0 1 120px" aria-label="Van price" />
                <label class="check"><input type="checkbox" name="active" value="1" checked={!!r.active} /> on</label>
                <button class="btn sm dark">Save</button></form></td></tr>
            ))}
            <tr><td colspan={6}><form method="post" action="/admin/taxi/route" class="row" style="gap:8px">
              <input name="destination" placeholder="New destination" style="flex:2 1 200px" required />
              <input type="number" name="km" placeholder="km" style="flex:0 1 90px" />
              <input type="number" name="price_car" placeholder="Car" style="flex:0 1 120px" />
              <input type="number" name="price_van" placeholder="Van" style="flex:0 1 120px" />
              <input type="hidden" name="active" value="1" />
              <button class="btn sm">Add</button></form></td></tr>
          </tbody></table>
        <p class="small muted">Price 0 = guests see "Price on request" and you set the price on the booking.</p>
      </div>
    </AdminPage>,
  )
})

app.post('/admin/taxi/route', async (c) => {
  const f = await c.req.parseBody()
  const vals = [str(f.destination, 120), int(f.km), int(f.price_car), int(f.price_van), f.active === '1' ? 1 : 0]
  if (!vals[0]) return errTo(c, '/admin/taxi', 'Destination is required.')
  if (int(f.id)) await c.env.DB.prepare('UPDATE taxi_routes SET destination=?, km=?, price_car=?, price_van=?, active=? WHERE id=?').bind(...vals, int(f.id)).run()
  else await c.env.DB.prepare('INSERT INTO taxi_routes (destination, km, price_car, price_van, active, sort) VALUES (?,?,?,?,?,100)').bind(...vals).run()
  return ok(c, '/admin/taxi', 'Route saved.')
})

app.post('/admin/taxi/settings', async (c) => {
  const f = await c.req.parseBody()
  const keys = ['taxi_rate_km_car', 'taxi_rate_km_van', 'taxi_min_fare', 'taxi_commission_pct']
  await c.env.DB.batch(keys.map((k) => c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k, String(int(f[k])))))
  return ok(c, '/admin/taxi', 'Formula saved.')
})

app.post('/admin/taxi/driver/:id', async (c) => {
  const st = String((await c.req.parseBody()).status)
  if (!['approved', 'blocked', 'pending'].includes(st)) return errTo(c, '/admin/taxi', 'Unknown status')
  await c.env.DB.prepare('UPDATE drivers SET status=? WHERE id=?').bind(st, int(c.req.param('id'))).run()
  return ok(c, '/admin/taxi', `Driver ${st}.`)
})

app.post('/admin/taxi/ledger/:id', async (c) => {
  const env = c.env
  const action = String((await c.req.parseBody()).action)
  const l = await env.DB.prepare("SELECT * FROM driver_ledger WHERE id=? AND status='pending'").bind(int(c.req.param('id'))).first<any>()
  if (!l) return errTo(c, '/admin/taxi', 'Not found')
  await env.DB.prepare('UPDATE driver_ledger SET status=? WHERE id=?').bind(action === 'confirm' ? 'confirmed' : 'rejected', l.id).run()
  if (action === 'confirm')
    await env.DB.prepare("INSERT INTO payments (business, kind, method, amount, note, slip_key, staff_id, paid_on) VALUES ('taxi','commission','bank',?,?,?,?,?)")
      .bind(-l.amount, `Driver commission payment (ledger #${l.id})`, l.slip_key, c.get('user')!.id, todayLocal(env)).run()
  return ok(c, '/admin/taxi', action === 'confirm' ? 'Payment confirmed and added to income.' : 'Payment rejected.')
})

// ---------------- Finance ----------------
const EXP_CATS = ['Fuel', 'Repairs & service', 'Spare parts', 'Staff salary', 'Partner owner payout', 'Jeep / supplier', 'Shop rent', 'Marketing', 'Insurance & licences', 'Other']

app.get('/admin/finance', async (c) => {
  const env = c.env, user = c.get('user')!
  const month = /^\d{4}-\d{2}$/.test(c.req.query('month') || '') ? c.req.query('month')! : todayLocal(env).slice(0, 7)
  const [inc, exps, list, vehicles, partner, supplier] = await Promise.all([
    env.DB.prepare("SELECT business, method, SUM(amount) AS s FROM payments WHERE kind NOT IN ('deposit','deposit_refund') AND substr(paid_on,1,7)=? GROUP BY business, method").bind(month).all<any>(),
    env.DB.prepare('SELECT business, SUM(amount) AS s FROM expenses WHERE substr(spent_on,1,7)=? GROUP BY business').bind(month).all<any>(),
    env.DB.prepare('SELECT x.*, v.name AS vehicle FROM expenses x LEFT JOIN vehicles v ON v.id=x.vehicle_id WHERE substr(spent_on,1,7)=? ORDER BY spent_on DESC, id DESC').bind(month).all<any>(),
    env.DB.prepare('SELECT id, name, plate FROM vehicles ORDER BY sort').all<any>(),
    env.DB.prepare(`SELECT v.owner_name, v.name, v.plate, b.ref, b.start_at, b.end_at, v.owner_rate_day FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id
      WHERE b.kind='scooter' AND b.status IN ('active','completed') AND v.owner_name IS NOT NULL AND substr(b.start_at,1,7)=?`).bind(month).all<any>(),
    env.DB.prepare("SELECT COALESCE(SUM(cost),0) AS s FROM bookings WHERE kind='experience' AND status IN ('confirmed','completed') AND substr(start_at,1,7)=?").bind(month).first<{ s: number }>(),
  ])
  const biz = ['scooter', 'experience', 'taxi', 'other']
  const incBy = (b: string) => inc.results.filter((r) => r.business === b).reduce((a, r) => a + r.s, 0)
  const expBy = (b: string) => exps.results.find((r) => r.business === b)?.s || 0
  const totalInc = biz.reduce((a, b) => a + incBy(b), 0), totalExp = biz.reduce((a, b) => a + expBy(b), 0)
  const byMethod = (m: string) => inc.results.filter((r) => r.method === m).reduce((a, r) => a + r.s, 0)
  const ownerOwed = partner.results.map((p) => ({ ...p, days: rentalDays(p.start_at, p.end_at), amount: rentalDays(p.start_at, p.end_at) * (p.owner_rate_day || 0) }))
  return c.html(
    <AdminPage env={env} user={user} path="/admin/finance" title="Finance">
      <div class="row between"><h1 style="font-size:28px;margin:0">Finance</h1>
        <form method="get" class="row"><input type="month" name="month" value={month} aria-label="Month" /><button class="btn dark sm">Show</button></form></div>
      <Msgs c={c} />
      <div class="tiles">
        <div class="stat">Income<b>{lkr(totalInc)}</b></div>
        <div class="stat">Expenses<b>{lkr(totalExp)}</b></div>
        <div class="stat" style={totalInc - totalExp >= 0 ? 'background:var(--ok)' : 'background:var(--bad)'}>Profit<b>{lkr(totalInc - totalExp)}</b></div>
      </div>
      <div class="card scroll"><table class="t">
        <thead><tr><th>Business</th><th>Income</th><th>Expenses</th><th>Profit</th></tr></thead>
        <tbody>{biz.map((b) => <tr><td>{b === 'experience' ? 'Safari & tours' : b[0].toUpperCase() + b.slice(1)}</td><td>{lkr(incBy(b))}</td><td>{lkr(expBy(b))}</td><td><b>{lkr(incBy(b) - expBy(b))}</b></td></tr>)}</tbody>
      </table>
        <p class="small muted">By method: cash {lkr(byMethod('cash'))} · card {lkr(byMethod('card'))} · bank {lkr(byMethod('bank'))} · online {lkr(byMethod('online'))}. Deposits are not counted as income.</p>
        <p class="small muted">Supplier costs for safaris & tours booked this month: {lkr(supplier?.s)} (add them as expenses when you pay).</p>
      </div>
      {ownerOwed.length > 0 && (
        <div class="card scroll"><h2 style="font-size:18px">Partner bike payouts this month</h2>
          <table class="t"><tbody>{ownerOwed.map((o) => <tr><td>{o.owner_name}</td><td>{o.name} {o.plate}</td><td>{o.ref}</td><td>{o.days} days</td><td><b>{lkr(o.amount)}</b></td></tr>)}</tbody></table>
        </div>
      )}
      <form class="card stack" method="post" action="/admin/finance/expense" enctype="multipart/form-data">
        <h2 style="font-size:18px;margin:0">Add expense</h2>
        <div class="form-grid">
          <label>Date<input type="date" name="spent_on" value={todayLocal(env)} required /></label>
          <label>Business<select name="business">{biz.map((b) => <option value={b}>{b === 'experience' ? 'safari & tours' : b}</option>)}</select></label>
          <label>Category<select name="category">{EXP_CATS.map((x) => <option>{x}</option>)}</select></label>
          <label>Amount (LKR)<input type="number" name="amount" min="1" required /></label>
          <label>Scooter (optional)<select name="vehicle_id"><option value="">—</option>{vehicles.results.map((v) => <option value={String(v.id)}>{v.name} {v.plate}</option>)}</select></label>
          <label>Receipt photo<input type="file" name="receipt" accept="image/*,application/pdf" /></label>
        </div>
        <label>Note<input name="note" /></label>
        <button class="btn dark">Save expense</button>
      </form>
      <div class="card scroll"><h2 style="font-size:18px">Expenses in {month}</h2>
        <table class="t"><tbody>{list.results.map((x) => <tr><td>{x.spent_on}</td><td>{x.business}</td><td>{x.category}{x.vehicle ? ` · ${x.vehicle}` : ''}</td><td>{x.note}{x.receipt_key && <> · <a href={`/files/${x.receipt_key}`} data-preview>receipt</a></>}</td><td>{lkr(x.amount)}</td>
          <td><form method="post" action={`/admin/finance/expense/${x.id}/delete`}><button class="btn ghost sm" onclick="return confirm('Delete this expense?')">Delete</button></form></td></tr>)}</tbody></table>
      </div>
      <p><a class="btn ghost" href={`/admin/finance/export.csv?month=${month}`}>Download {month} as CSV (Excel)</a></p>
    </AdminPage>,
  )
})

app.post('/admin/finance/expense', async (c) => {
  const env = c.env
  const f = await c.req.parseBody()
  const amount = int(f.amount)
  const date = normDate(f.spent_on)
  if (amount <= 0 || !date) return errTo(c, '/admin/finance', 'Date and amount are required.')
  let key: string | null = null
  try { key = (await putUpload(env.BUCKET, 'receipts', f.receipt))?.key ?? null } catch (e: any) { return errTo(c, '/admin/finance', e.message) }
  const biz = ['scooter', 'experience', 'taxi', 'other'].includes(String(f.business)) ? String(f.business) : 'other'
  await env.DB.prepare('INSERT INTO expenses (business, category, amount, spent_on, note, vehicle_id, receipt_key, created_by) VALUES (?,?,?,?,?,?,?,?)')
    .bind(biz, str(f.category, 60) || 'Other', amount, date, str(f.note, 300), nullInt(f.vehicle_id), key, c.get('user')!.id).run()
  return ok(c, `/admin/finance?month=${date.slice(0, 7)}`, 'Expense saved.')
})

app.post('/admin/finance/expense/:id/delete', async (c) => {
  await c.env.DB.prepare('DELETE FROM expenses WHERE id=?').bind(int(c.req.param('id'))).run()
  return ok(c, '/admin/finance', 'Expense deleted.')
})

app.get('/admin/finance/export.csv', async (c) => {
  const env = c.env
  const month = /^\d{4}-\d{2}$/.test(c.req.query('month') || '') ? c.req.query('month')! : todayLocal(env).slice(0, 7)
  const p = await env.DB.prepare('SELECT p.paid_on AS date, p.business, p.kind, p.method, p.amount, b.ref, p.note FROM payments p LEFT JOIN bookings b ON b.id=p.booking_id WHERE substr(p.paid_on,1,7)=? ORDER BY p.paid_on').bind(month).all<any>()
  const e = await env.DB.prepare('SELECT spent_on AS date, business, category, amount, note FROM expenses WHERE substr(spent_on,1,7)=? ORDER BY spent_on').bind(month).all<any>()
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = [['date', 'type', 'business', 'detail', 'method', 'amount', 'booking', 'note'].join(',')]
  for (const r of p.results) rows.push([r.date, 'income', r.business, r.kind, r.method, r.amount, r.ref, r.note].map(q).join(','))
  for (const r of e.results) rows.push([r.date, 'expense', r.business, r.category, '', -r.amount, '', r.note].map(q).join(','))
  return c.body('﻿' + rows.join('\n'), 200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="migga-${month}.csv"` })
})

// ---------------- Agreement ----------------
const PLACEHOLDERS = '{ref} {guest_name} {nationality} {dob} {passport_no} {phone} {email} {stay_address} {home_address} {emergency_contact} {licence_no} {licence_country} {idp_no} {permit} {vehicle} {plate} {start} {end} {days} {rental_price} {extras} {total} {deposit} and any setting key such as {late_fee_hour}'

app.get('/admin/agreement', async (c) => {
  const env = c.env, user = c.get('user')!
  const { results } = await env.DB.prepare('SELECT id, title, active, created_at, body FROM agreement_versions ORDER BY id DESC').all<any>()
  const current = results.find((r) => r.active) || results[0]
  return c.html(
    <AdminPage env={env} user={user} path="/admin/agreement" title="Agreement">
      <h1 style="font-size:28px;margin:0">Rental agreement</h1>
      <Msgs c={c} />
      <p class="muted" style="margin:0">Saving creates a new version for new bookings. Guests who already signed keep the exact text they signed.</p>
      <form class="card stack" method="post" action="/admin/agreement">
        <label>Title<input name="title" value={`Scooter Rental Agreement v${results.length + 1}`} required /></label>
        <label>Text<textarea name="body" style="min-height:480px;font-family:ui-monospace,monospace;font-size:14px" required>{current?.body || ''}</textarea></label>
        <p class="small muted" style="margin:0">Lines starting with "## " become headings. Placeholders: {PLACEHOLDERS}.</p>
        <button class="btn dark">Save as new version</button>
      </form>
      <div class="card scroll"><table class="t"><thead><tr><th>Version</th><th>Created</th><th></th></tr></thead>
        <tbody>{results.map((r) => <tr><td>{r.title}</td><td>{r.created_at.slice(0, 10)}</td><td>{r.active ? <span class="badge ok">In use</span> : ''}</td></tr>)}</tbody></table></div>
    </AdminPage>,
  )
})

app.post('/admin/agreement', async (c) => {
  const f = await c.req.parseBody()
  const body = String(f.body || '').replace(/\r\n/g, '\n').trim().slice(0, 30000)
  if (body.length < 50) return errTo(c, '/admin/agreement', 'The agreement text is too short.')
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE agreement_versions SET active=0'),
    c.env.DB.prepare('INSERT INTO agreement_versions (title, body, active) VALUES (?,?,1)').bind(str(f.title, 120), body),
  ])
  return ok(c, '/admin/agreement', 'New agreement version saved and in use.')
})

// ---------------- Settings, extras, damage price list ----------------
const SETTING_LABELS: [string, string][] = [
  ['shop_address', 'Shop address (shown to guests)'], ['maps_url', 'Google Maps link to the shop'], ['late_grace_min', 'Late return grace (minutes)'],
  ['late_fee_hour', 'Late fee per hour (LKR)'], ['late_full_day_hours', 'Charge a full day after this many hours late'], ['fuel_charge', 'Fuel shortfall charge (LKR)'],
  ['key_fee', 'Lost key (LKR)'], ['cancel_hours', 'Free cancellation until (hours before)'], ['retention_days', 'Delete guest documents after (days)'],
  ['card_fee_pct', 'Card service fee % (bank charge, paid by guest)'], ['permit_service_price', 'AAC permit service price (LKR)'], ['delivery_fee', 'Hotel delivery fee (LKR, 0 = free)'],
]

app.get('/admin/settings', async (c) => {
  const env = c.env, user = c.get('user')!
  const [s, extras, damage] = await Promise.all([getSettings(env.DB), env.DB.prepare('SELECT * FROM extras ORDER BY sort, id').all<any>(), env.DB.prepare('SELECT * FROM damage_items ORDER BY id').all<any>()])
  return c.html(
    <AdminPage env={env} user={user} path="/admin/settings" title="Settings">
      <h1 style="font-size:28px;margin:0">Prices & settings</h1>
      <Msgs c={c} />
      <form class="card stack" method="post" action="/admin/settings">
        <h2 style="font-size:18px;margin:0">Rules & fees</h2>
        <div class="form-grid">{SETTING_LABELS.map(([k, l]) => <label>{l}<input name={k} value={s[k] ?? ''} /></label>)}</div>
        <button class="btn dark">Save</button>
      </form>
      <div class="card scroll"><h2 style="font-size:18px">Extras (free or paid)</h2>
        {[...extras.results, { id: 0, name: '', price: 0, per: 'rental', applies_to: 'scooter', stock: null, active: 1, sort: 50 }].map((e) => (
          <form method="post" action="/admin/settings/extra" class="row" style="gap:8px;margin-bottom:8px">
            <input type="hidden" name="id" value={String(e.id)} />
            <input name="name" value={e.name} placeholder="New extra" style="flex:2 1 180px" required />
            <input type="number" name="price" value={e.price} min="0" style="flex:0 1 110px" aria-label="Price" />
            <select name="per" style="flex:0 1 120px">{['rental', 'day', 'person'].map((x) => <option selected={e.per === x}>{x}</option>)}</select>
            <select name="applies_to" style="flex:0 1 130px">{['scooter', 'experience', 'all'].map((x) => <option selected={e.applies_to === x}>{x}</option>)}</select>
            <input type="number" name="stock" value={e.stock ?? ''} placeholder="stock" style="flex:0 1 90px" aria-label="Stock" />
            <label class="check"><input type="checkbox" name="active" value="1" checked={!!e.active} /> on</label>
            <button class="btn sm dark">{e.id ? 'Save' : 'Add'}</button>
          </form>
        ))}
        <p class="small muted">Price 0 = free. Stock = how many you own (empty = unlimited).</p>
      </div>
      <div class="card scroll"><h2 style="font-size:18px">Damage price list</h2>
        {[...damage.results, { id: 0, name: '', price: 0, active: 1 }].map((d) => (
          <form method="post" action="/admin/settings/damage" class="row" style="gap:8px;margin-bottom:8px">
            <input type="hidden" name="id" value={String(d.id)} />
            <input name="name" value={d.name} placeholder="New damage item" style="flex:2 1 220px" required />
            <input type="number" name="price" value={d.price} min="0" style="flex:0 1 130px" aria-label="Price" />
            <label class="check"><input type="checkbox" name="active" value="1" checked={!!d.active} /> on</label>
            <button class="btn sm dark">{d.id ? 'Save' : 'Add'}</button>
          </form>
        ))}
      </div>
    </AdminPage>,
  )
})

app.post('/admin/settings', async (c) => {
  const f = await c.req.parseBody()
  await c.env.DB.batch(SETTING_LABELS.map(([k]) => c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k, str(f[k], 500))))
  return ok(c, '/admin/settings', 'Settings saved.')
})
app.post('/admin/settings/extra', async (c) => {
  const f = await c.req.parseBody()
  const vals = [str(f.name, 80), int(f.price), ['rental', 'day', 'person'].includes(String(f.per)) ? String(f.per) : 'rental', ['scooter', 'experience', 'all'].includes(String(f.applies_to)) ? String(f.applies_to) : 'scooter', nullInt(f.stock), f.active === '1' ? 1 : 0]
  if (int(f.id)) await c.env.DB.prepare('UPDATE extras SET name=?, price=?, per=?, applies_to=?, stock=?, active=? WHERE id=?').bind(...vals, int(f.id)).run()
  else await c.env.DB.prepare('INSERT INTO extras (name, price, per, applies_to, stock, active, sort) VALUES (?,?,?,?,?,?,50)').bind(...vals).run()
  return ok(c, '/admin/settings', 'Extra saved.')
})
app.post('/admin/settings/damage', async (c) => {
  const f = await c.req.parseBody()
  const vals = [str(f.name, 80), int(f.price), f.active === '1' ? 1 : 0]
  if (int(f.id)) await c.env.DB.prepare('UPDATE damage_items SET name=?, price=?, active=? WHERE id=?').bind(...vals, int(f.id)).run()
  else await c.env.DB.prepare('INSERT INTO damage_items (name, price, active) VALUES (?,?,?)').bind(...vals).run()
  return ok(c, '/admin/settings', 'Damage item saved.')
})

// ---------------- Users ----------------
app.get('/admin/users', async (c) => {
  const env = c.env, user = c.get('user')!
  const { results } = await env.DB.prepare('SELECT id, email, name, role, active FROM users ORDER BY id').all<any>()
  return c.html(
    <AdminPage env={env} user={user} path="/admin/users" title="Staff logins">
      <h1 style="font-size:28px;margin:0">Staff logins</h1>
      <Msgs c={c} />
      <div class="card scroll"><table class="t"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th></th></tr></thead>
        <tbody>{results.map((u) => (
          <tr><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.active ? 'yes' : 'no'}</td>
            <td><form method="post" action={`/admin/users/${u.id}`} class="row" style="gap:6px">
              <input type="password" name="password" placeholder="New password" minlength={10} style="flex:1 1 160px" autocomplete="new-password" />
              <button class="btn sm ghost" name="action" value="password">Set password</button>
              {u.id !== user.id && <button class="btn sm ghost" name="action" value="toggle">{u.active ? 'Disable' : 'Enable'}</button>}
            </form></td></tr>
        ))}</tbody></table></div>
      <form class="card stack" method="post" action="/admin/users">
        <h2 style="font-size:18px;margin:0">Add login</h2>
        <div class="form-grid">
          <label>Name<input name="name" required /></label>
          <label>Email<input type="email" name="email" required /></label>
          <label>Password (min 10 characters)<input type="password" name="password" minlength={10} required autocomplete="new-password" /></label>
          <label>Role<select name="role"><option value="staff">Shop staff (tablet)</option><option value="admin">Admin (everything)</option></select></label>
        </div>
        <button class="btn dark">Add</button>
      </form>
    </AdminPage>,
  )
})

app.post('/admin/users', async (c) => {
  const f = await c.req.parseBody()
  const email = str(f.email, 160).toLowerCase(), pw = String(f.password || '')
  if (!isEmail(email) || pw.length < 10) return errTo(c, '/admin/users', 'Valid email and a password of at least 10 characters are required.')
  try {
    await c.env.DB.prepare('INSERT INTO users (email, name, role, pass_hash) VALUES (?,?,?,?)').bind(email, str(f.name, 80), f.role === 'admin' ? 'admin' : 'staff', await hashPassword(pw)).run()
  } catch { return errTo(c, '/admin/users', 'That email already has a login.') }
  return ok(c, '/admin/users', 'Login created.')
})

app.post('/admin/users/:id', async (c) => {
  const f = await c.req.parseBody()
  const id = int(c.req.param('id'))
  if (f.action === 'password') {
    const pw = String(f.password || '')
    if (pw.length < 10) return errTo(c, '/admin/users', 'Password must be at least 10 characters.')
    await c.env.DB.prepare('UPDATE users SET pass_hash=? WHERE id=?').bind(await hashPassword(pw), id).run()
    return ok(c, '/admin/users', 'Password updated.')
  }
  if (f.action === 'toggle' && id !== c.get('user')!.id) await c.env.DB.prepare('UPDATE users SET active = 1 - active WHERE id=?').bind(id).run()
  return ok(c, '/admin/users', 'Updated.')
})

export default app

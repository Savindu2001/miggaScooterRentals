import { Hono } from 'hono'
import type { AppEnv } from '../lib/env'
import { GuestPage, Flash } from '../views/layout'
import { fmtDT, int, lkr } from '../lib/util'
import { putUpload } from '../lib/files'
import { bookingByRef } from '../lib/bookings'
import { completeTaxi, notifyTaxiConfirmed } from './staff'

const app = new Hono<AppEnv>()

type Driver = { id: number; name: string; phone: string; vehicle_type: string; status: string; token: string }
const getDriver = (db: D1Database, token: string) => db.prepare('SELECT * FROM drivers WHERE token = ?').bind(token).first<Driver>()

export async function driverBalance(db: D1Database, id: number) {
  const r = await db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM driver_ledger WHERE driver_id = ? AND status = 'confirmed'").bind(id).first<{ s: number }>()
  return r?.s ?? 0
}

app.get('/d/:token', async (c) => {
  const env = c.env
  const d = await getDriver(env.DB, c.req.param('token'))
  if (!d) return c.notFound()
  if (d.status !== 'approved')
    return c.html(<GuestPage env={env} title="Driver"><div class="notice warn">Hi {d.name}, your registration is {d.status === 'pending' ? 'waiting for approval' : 'not active'}. Please contact Migga.</div></GuestPage>)
  const jobs = (await env.DB.prepare("SELECT * FROM bookings WHERE kind='taxi' AND driver_id = ? AND status IN ('pending','confirmed') ORDER BY start_at").bind(d.id).all<any>()).results
  const ledger = (await env.DB.prepare('SELECT * FROM driver_ledger WHERE driver_id = ? ORDER BY id DESC LIMIT 30').bind(d.id).all<any>()).results
  const balance = await driverBalance(env.DB, d.id)
  return c.html(
    <GuestPage env={env} title="My trips">
      <h1 style="font-size:28px">Hi {d.name}</h1>
      <Flash msg={c.req.query('ok')} />
      <div class={`tile ${balance > 0 ? 'warn' : ''}`} style="padding:16px">You owe Migga<b style="font-size:24px">{lkr(Math.max(0, balance))}</b>{balance < 0 && <span class="small">Credit {lkr(-balance)}</span>}</div>
      <h2 class="mt" style="font-size:20px">Trips</h2>
      <div class="stack">
        {jobs.map((j) => (
          <div class="card stack">
            <div class="row between"><b>{j.pickup_location} → {j.destination}</b><span class={`badge ${j.driver_status === 'accepted' ? 'ok' : 'warn'}`}>{j.driver_status === 'accepted' ? 'Accepted' : 'New offer'}</span></div>
            <div class="small">{fmtDT(j.start_at)} · {j.pax} passengers · {j.vehicle_type}</div>
            <div class="small">Price {lkr(j.total)} (guest pays you) · Migga commission <b>{lkr(j.commission)}</b></div>
            {j.driver_status === 'accepted' && <div class="small">Guest: {j.guest_name} · <a href={`tel:${j.phone}`}>{j.phone}</a>{j.notes ? ` · ${j.notes}` : ''}</div>}
            <form method="post" action={`/d/${d.token}/job/${j.ref}`} class="row">
              {j.driver_status !== 'accepted' && <button class="btn green" name="action" value="accept">Accept trip</button>}
              {j.driver_status !== 'accepted' && <button class="btn ghost" name="action" value="decline">Decline</button>}
              {j.driver_status === 'accepted' && <button class="btn dark" name="action" value="done">Trip finished</button>}
            </form>
          </div>
        ))}
        {!jobs.length && <p class="muted">No trips right now.</p>}
      </div>
      <form method="post" action={`/d/${d.token}/pay`} enctype="multipart/form-data" class="card stack mt">
        <h2 style="font-size:20px;margin:0">I paid Migga</h2>
        <label>Amount (LKR)<input type="number" name="amount" min="1" required /></label>
        <label>Bank slip photo<input type="file" name="slip" accept="image/*,application/pdf" required /></label>
        <button class="btn dark">Send payment</button>
      </form>
      <h2 class="mt" style="font-size:20px">History</h2>
      <div class="card scroll"><table class="t"><tbody>
        {ledger.map((l) => <tr><td>{l.created_at.slice(0, 10)}</td><td>{l.note}{l.status !== 'confirmed' && <span class="badge warn"> {l.status}</span>}</td><td style="text-align:right">{lkr(l.amount)}</td></tr>)}
      </tbody></table></div>
    </GuestPage>,
  )
})

app.post('/d/:token/job/:ref', async (c) => {
  const env = c.env
  const d = await getDriver(env.DB, c.req.param('token'))
  if (!d || d.status !== 'approved') return c.notFound()
  const b = await bookingByRef(env.DB, c.req.param('ref'))
  if (!b || b.driver_id !== d.id) return c.notFound()
  const action = String((await c.req.parseBody()).action)
  if (action === 'accept' && b.driver_status === 'offered') {
    await env.DB.prepare("UPDATE bookings SET driver_status='accepted', status='confirmed' WHERE id=?").bind(b.id).run()
    await notifyTaxiConfirmed(c, env, b.ref)
    return c.redirect(`/d/${d.token}?ok=${encodeURIComponent('Trip accepted. The guest got your name and phone.')}`)
  }
  if (action === 'decline' && b.driver_status === 'offered') {
    await env.DB.prepare("UPDATE bookings SET driver_id=NULL, driver_status='' WHERE id=?").bind(b.id).run()
    return c.redirect(`/d/${d.token}?ok=Declined`)
  }
  if (action === 'done' && b.driver_status === 'accepted') {
    await completeTaxi(env, b)
    return c.redirect(`/d/${d.token}?ok=${encodeURIComponent(`Thanks! ${lkr(b.commission)} commission added.`)}`)
  }
  return c.redirect(`/d/${d.token}`)
})

app.post('/d/:token/pay', async (c) => {
  const env = c.env
  const d = await getDriver(env.DB, c.req.param('token'))
  if (!d || d.status !== 'approved') return c.notFound()
  const f = await c.req.parseBody()
  const amount = int(f.amount)
  if (amount <= 0) return c.redirect(`/d/${d.token}`)
  let key: string | null = null
  try { key = (await putUpload(env.BUCKET, `drivers/${d.id}`, f.slip))?.key ?? null } catch (e: any) { return c.redirect(`/d/${d.token}?ok=${encodeURIComponent(e.message)}`) }
  await env.DB.prepare("INSERT INTO driver_ledger (driver_id, amount, note, slip_key, status) VALUES (?,?,?,?,'pending')").bind(d.id, -amount, 'Payment to Migga', key).run()
  return c.redirect(`/d/${d.token}?ok=${encodeURIComponent('Payment sent. Migga will confirm it.')}`)
})

export default app

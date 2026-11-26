import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import type { AppEnv, Env } from './lib/env'
import { endSession, hashPassword, loadUser, loginAllowed, recordFailedLogin, startSession, verifyPassword } from './lib/auth'
import { GuestPage, Flash, Page } from './views/layout'
import { int, isEmail, str } from './lib/util'
import { bookingById } from './lib/bookings'
import { reviewEmail, sendMail } from './lib/email'
import publicRoutes from './routes/public'
import bookingRoutes from './routes/booking'
import staffRoutes from './routes/staff'
import adminRoutes from './routes/admin'
import driverRoutes from './routes/driver'

const app = new Hono<AppEnv>()

const headers = secureHeaders({ crossOriginEmbedderPolicy: false, xFrameOptions: 'DENY', referrerPolicy: 'strict-origin-when-cross-origin', permissionsPolicy: { camera: ['self'] } })
const fileHeaders = secureHeaders({ crossOriginEmbedderPolicy: false, xFrameOptions: 'SAMEORIGIN', referrerPolicy: 'strict-origin-when-cross-origin' })
// Private files may be shown inside our own preview popup (PDFs), never on other sites.
app.use('*', (c, next) => (c.req.path.startsWith('/files/') ? fileHeaders(c, next) : headers(c, next)))
app.use('*', csrf()) // rejects cross-site form posts
app.use('*', loadUser)

// ---------- auth ----------
const safeNext = (n?: string) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/staff')

app.get('/login', (c) =>
  c.html(
    <GuestPage env={c.env} title="Staff login">
      <h1 style="font-size:28px">Staff login</h1>
      <Flash msg={c.req.query('error')} kind="bad" />
      <form method="post" class="card stack">
        <input type="hidden" name="next" value={safeNext(c.req.query('next'))} />
        <label>Email<input type="email" name="email" autocomplete="username" required /></label>
        <label>Password<input type="password" name="password" autocomplete="current-password" required /></label>
        <button class="btn big">Log in</button>
      </form>
    </GuestPage>,
  ),
)

app.post('/login', async (c) => {
  const env = c.env
  const f = await c.req.parseBody()
  const ip = c.req.header('cf-connecting-ip') || 'local'
  const next = safeNext(String(f.next || ''))
  if (!(await loginAllowed(env.DB, ip))) return c.redirect('/login?error=' + encodeURIComponent('Too many attempts. Try again in 15 minutes.'))
  const u = await env.DB.prepare('SELECT id, pass_hash, role FROM users WHERE email = ? AND active = 1').bind(str(f.email, 160).toLowerCase()).first<{ id: number; pass_hash: string; role: string }>()
  if (!u || !(await verifyPassword(String(f.password || ''), u.pass_hash))) {
    await recordFailedLogin(env.DB, ip)
    return c.redirect(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent('Wrong email or password.')}`)
  }
  await startSession(c, u.id)
  return c.redirect(next === '/staff' && u.role === 'admin' ? '/admin' : next)
})

app.post('/logout', (c) => {
  endSession(c)
  return c.redirect('/login')
})

// First run only: create the owner's admin login when no users exist yet.
app.get('/setup', async (c) => {
  const n = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>())?.n ?? 0
  if (n > 0) return c.redirect('/login')
  return c.html(
    <GuestPage env={c.env} title="Set up Migga">
      <h1 style="font-size:28px">Create the owner login</h1>
      <Flash msg={c.req.query('error')} kind="bad" />
      <form method="post" class="card stack">
        <label>Your name<input name="name" required /></label>
        <label>Email<input type="email" name="email" required /></label>
        <label>Password (min 10 characters)<input type="password" name="password" minlength={10} required autocomplete="new-password" /></label>
        <button class="btn big">Create admin</button>
      </form>
    </GuestPage>,
  )
})

app.post('/setup', async (c) => {
  const env = c.env
  const f = await c.req.parseBody()
  const email = str(f.email, 160).toLowerCase(), pw = String(f.password || '')
  if (!isEmail(email) || pw.length < 10) return c.redirect('/setup?error=' + encodeURIComponent('Valid email and a 10+ character password are required.'))
  // Only inserts when the table is still empty (atomic guard against a race).
  const r = await env.DB.prepare("INSERT INTO users (email, name, role, pass_hash) SELECT ?, ?, 'admin', ? WHERE NOT EXISTS (SELECT 1 FROM users) RETURNING id")
    .bind(email, str(f.name, 80) || 'Owner', await hashPassword(pw)).first<{ id: number }>()
  if (!r) return c.redirect('/login')
  await startSession(c, r.id)
  return c.redirect('/admin')
})

app.get('/admin/bookings/:id{[0-9]+}', async (c) => {
  if (!c.get('user')) return c.redirect('/login')
  const b = await bookingById(c.env.DB, int(c.req.param('id')))
  return b ? c.redirect(`/staff/booking/${b.ref}`) : c.notFound()
})

app.route('/', publicRoutes)
app.route('/', bookingRoutes)
app.route('/', staffRoutes)
app.route('/', adminRoutes)
app.route('/', driverRoutes)

app.notFound((c) =>
  c.html(
    <Page env={c.env} title="Page not found · Migga" noindex>
      <section class="block"><div class="wrap"><h1>Page not found</h1><p><a href="/">Go to the Migga home page</a></p></div></section>
    </Page>,
    404,
  ),
)

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  console.error('Unhandled error', c.req.method, c.req.path, err)
  if (err.message === 'not found') return c.notFound()
  return c.html(
    <GuestPage env={c.env} title="Something went wrong">
      <h1 style="font-size:28px">Sorry, something went wrong</h1>
      <p>Please try again. If it keeps happening, message us on WhatsApp.</p>
      <p><a href="/">Home</a></p>
    </GuestPage>,
    500,
  )
})

// ---------- daily jobs (cron) ----------
async function daily(env: Env) {
  // 1. Review requests the day after a booking is completed.
  const { results } = await env.DB.prepare(
    "SELECT id FROM bookings WHERE status='completed' AND review_sent=0 AND COALESCE(actual_return_at, start_at) < datetime('now','+330 minutes','-12 hours') AND COALESCE(actual_return_at, start_at) > datetime('now','-10 days') LIMIT 50",
  ).all<{ id: number }>()
  for (const r of results) {
    const b = await bookingById(env.DB, r.id)
    if (!b) continue
    await env.DB.prepare('UPDATE bookings SET review_sent=1 WHERE id=?').bind(b.id).run()
    await sendMail(env, b.email, 'How was your time with Migga?', reviewEmail(env, b))
  }
  // 2. Delete guest documents after the retention period (privacy).
  const days = int((await env.DB.prepare("SELECT value FROM settings WHERE key='retention_days'").first<{ value: string }>())?.value, 90) || 90
  const { results: old } = await env.DB.prepare(
    `SELECT d.id, d.r2_key FROM documents d JOIN bookings b ON b.id=d.booking_id
     WHERE b.status IN ('completed','cancelled') AND COALESCE(b.end_at, b.start_at) < date('now', ?) LIMIT 500`,
  ).bind(`-${days} days`).all<{ id: number; r2_key: string }>()
  if (old.length) {
    await env.BUCKET.delete(old.map((o) => o.r2_key))
    await env.DB.batch(old.map((o) => env.DB.prepare('DELETE FROM documents WHERE id=?').bind(o.id)))
  }
  // 3. Cancel scooter bookings that were never finished (no signature after 2 days).
  await env.DB.prepare("UPDATE bookings SET status='cancelled' WHERE kind='scooter' AND status='pending' AND created_at < datetime('now','-2 days')").run()
}

export default {
  fetch: app.fetch,
  scheduled: (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => ctx.waitUntil(daily(env)),
}

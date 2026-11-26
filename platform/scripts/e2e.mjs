// End-to-end test against a running server (default: local `wrangler dev`).
// Usage: npm run dev   (in one terminal)   then   BASE=http://127.0.0.1:8787 npm test
// Uses a fresh local database: run `rm -rf .wrangler && npm run db:migrate:local` first.
import { readFileSync } from 'node:fs'

const BASE = process.env.BASE || 'http://127.0.0.1:8787'
const TAXI = process.env.TAXI === 'on' // run with: TAXI=on npm test  (server started with --var FEATURE_TAXI:on)
const ADMIN = { email: 'owner@test.lk', password: 'very-secret-pass-1' }
let cookie = ''
let passed = 0
const png = readFileSync(new URL('../public/img/logo-email.png', import.meta.url))
const fail = (m) => { console.error('✗ ' + m); process.exit(1) }
const ok = (cond, m) => { if (!cond) fail(m); passed++; console.log('✓ ' + m) }

async function req(method, path, { form, multipart, auth = true, origin = BASE } = {}) {
  const headers = { Origin: origin }
  if (auth && cookie) headers.Cookie = cookie
  let body
  if (form) { body = new URLSearchParams(form); headers['Content-Type'] = 'application/x-www-form-urlencoded' }
  if (multipart) {
    body = new FormData()
    for (const [k, v] of Object.entries(multipart)) {
      for (const item of Array.isArray(v) ? v : [v]) {
        if (item instanceof Blob) body.append(k, item, 'photo.png')
        else body.append(k, String(item))
      }
    }
  }
  const r = await fetch(BASE + path, { method, headers, body, redirect: 'manual' })
  const set = r.headers.get('set-cookie')
  if (set && set.includes('migga_session=')) cookie = set.split(';')[0]
  return { status: r.status, location: r.headers.get('location') || '', text: await r.text() }
}
const get = (p, o) => req('GET', p, o)
const post = (p, o) => req('POST', p, o)
const img = () => new Blob([png], { type: 'image/png' })
const day = (n) => { const d = new Date(Date.now() + 330 * 60000 + n * 86400000); return d.toISOString().slice(0, 10) }
const sigData = 'data:image/png;base64,' + png.toString('base64')

// ---------- security basics ----------
ok((await get('/admin', { auth: false })).status === 302, 'admin requires login')
ok((await get('/files/bookings/x.png', { auth: false })).status === 302, 'private files require login')
ok((await post('/login', { form: { email: 'x@y.z', password: 'nope' }, origin: 'https://evil.example' })).status === 403, 'cross-site POST blocked (CSRF)')

// ---------- first-run setup ----------
let r = await post('/setup', { form: { name: 'Owner', ...ADMIN } })
ok(r.status === 302 && r.location === '/admin', 'owner admin created via /setup')
ok((await get('/setup')).status === 302, '/setup disabled once a user exists')
cookie = ''
r = await post('/login', { form: { email: ADMIN.email, password: 'wrong-password' } })
ok(r.location.includes('error'), 'wrong password rejected')
r = await post('/login', { form: { ...ADMIN } })
ok(r.status === 302 && cookie, 'admin login works')
const adminCookie = cookie

// ---------- admin config ----------
r = await post('/admin/vehicles', { multipart: { id: 1, name: 'Honda Dio 110cc', plate: 'BJK-1850', rate_day: 3500, rate_3day: 9900, rate_week: 21000, rate_month: 70000, deposit: 5000, status: 'active', sort: 1, description: 'Automatic' } })
ok(r.location.includes('ok='), 'vehicle prices saved (3-day, week, month)')
r = await post('/admin/settings/damage', { form: { id: 5, name: 'Side panel scratch', price: 4000, active: '1' } })
ok(r.location.includes('ok='), 'damage price saved')
r = await post('/admin/taxi/route', { form: { id: 3, destination: 'Kandy', km: 90, price_car: 12000, price_van: 15000, active: '1' } })
ok(r.location.includes('ok='), 'taxi route price saved')
r = await post('/admin/users', { form: { name: 'Suranga', email: 'staff@test.lk', password: 'staff-password-1', role: 'staff' } })
ok(r.location.includes('ok='), 'staff login created')

// ---------- guest: scooter booking ----------
cookie = ''
const start = `${day(1)} 09:00`, end = `${day(4)} 09:00`
r = await get(`/book/scooter?start=${start}&end=${end}`)
ok(r.status === 200 && r.text.includes('9,900'), 'availability page shows 3-day package price')
const guest = { start, end, vehicle_id: 1, extras: ['1', '2'], permit_option: 'have', guest_name: 'Tebin Test', nationality: 'German', dob: '1995-04-02', passport_no: 'cfy33njr2',
  email: 'tebin@example.com', phone: '+49 1577 8799104', stay_address: 'Sigiriya Village Hotel', emergency_contact: 'Anna +49 111', licence_no: 'B123', licence_country: 'Germany', idp_no: 'IDP9', pickup: 'shop', payment_pref: 'shop' }
r = await post('/book/scooter', { multipart: guest, auth: false })
ok(r.status === 302 && /\/b\/[\w-]+\/docs$/.test(r.location), 'booking created → documents step')
const token = r.location.split('/')[2]
r = await post(`/b/${token}/docs`, { multipart: { passport: img(), licence: img() }, auth: false })
ok(r.location.includes('error=') && r.location.includes('Driving'), 'missing IDP is required')
r = await post(`/b/${token}/docs`, { multipart: { idp: img() }, auth: false })
ok(r.location.endsWith('/sign'), 'all documents uploaded → sign step')
r = await get(`/b/${token}/sign`, { auth: false })
ok(r.text.includes('TEBIN') || r.text.includes('Tebin Test'), 'agreement filled with guest details')
ok(r.text.includes('CFY33NJR2'), 'agreement shows passport number')
r = await post(`/b/${token}/sign`, { form: { agree: '1', signature: 'data:image/png;base64,AAAA' }, auth: false })
ok(r.location.includes('error='), 'empty signature rejected')
r = await post(`/b/${token}/sign`, { form: { agree: '1', signature: sigData }, auth: false })
ok(r.location.includes('signed=1'), 'signed → confirmed')
r = await get(`/b/${token}`, { auth: false })
ok(r.text.includes('<svg') && r.text.includes('Confirmed'), 'guest page shows QR + confirmed')
const ref = /MS-\d{4}-\d{4}/.exec(r.text)[0]
ok((await get(`/qr/${token}.gif`, { auth: false })).status === 200, 'email QR image works')
ok((await get(`/b/${token}/agreement`, { auth: false })).text.includes('Signed electronically'), 'signed agreement page')

// double booking
r = await post('/book/scooter', { multipart: { ...guest, start: `${day(2)} 10:00`, end: `${day(3)} 10:00` }, auth: false })
ok(r.location.includes('error='), 'overlapping booking for same scooter is refused')

// ---------- staff tablet ----------
cookie = ''
await post('/login', { form: { email: 'staff@test.lk', password: 'staff-password-1' } })
r = await get(`/staff/booking/${ref}`)
ok(r.status === 200 && r.text.includes('Tebin Test') && r.text.includes('Signed'), 'staff opens booking from QR link')
ok((await get('/admin/finance')).status === 403, 'staff cannot open admin finance')
r = await post(`/staff/booking/${ref}/payment`, { multipart: { kind: 'rental', amount: 9900, method: 'cash' } })
ok(r.location.includes('ok='), 'cash payment recorded')
r = await post(`/staff/booking/${ref}/payment`, { multipart: { kind: 'deposit', amount: 5000, method: 'cash' } })
ok(r.location.includes('ok='), 'deposit recorded')
const photos = Object.fromEntries(['front', 'back', 'left', 'right', 'odometer', 'fuel'].map((a) => [`photo_${a}`, img()]))
r = await post(`/staff/booking/${ref}/pickup`, { multipart: { ...photos, km: 12214, fuel: '½', items: '1 key, 2 helmets', notes: 'small scratch front' } })
ok(r.location.includes('ok='), 'pickup inspection saved, scooter out')

// guest asks for an extension
r = await post(`/b/${token}/extend`, { form: { new_end: `${day(5)} 09:00` }, auth: false })
ok(r.location.includes('ok='), 'guest requested extension')
r = await get(`/staff/booking/${ref}`)
const extId = /extension\/(\d+)/.exec(r.text)[1]
r = await post(`/staff/booking/${ref}/extension/${extId}`, { form: { action: 'approve', amount: 3500 } })
ok(r.location.includes('ok='), 'extension approved')
r = await get(`/staff/booking/${ref}`)
ok(r.text.includes('3,500'), 'balance shows extension amount to collect')

// return with damage + fuel
r = await post(`/staff/booking/${ref}/return`, { multipart: { photo_left: img(), km: 12480, fuel: '¼', damage: '5', fuel_short: '1', refund_method: 'cash' } })
ok(r.status === 302, 'return inspection saved')
r = await get(`/staff/booking/${ref}`)
ok(r.text.includes('Completed'), 'rental completed')
// charges 4000 + 500 fuel + 3500 extension unpaid = 8000 taken from 5000 deposit → 3000 still to collect
ok(r.text.includes('LKR 3,000'), 'charges taken from deposit, remaining balance shown')

// card payment: 3.5% service fee added so Migga still receives the full amount
r = await post(`/staff/booking/${ref}/payment`, { multipart: { kind: 'charge', amount: 3000, method: 'card' } })
ok(decodeURIComponent(r.location).includes('swipe LKR 3,109'), 'card payment adds service fee (3,000 → swipe 3,109)')
r = await get(`/staff/booking/${ref}`)
ok(r.text.includes('Fully paid'), 'balance fully paid after card payment incl. fee')
ok(r.text.includes('Card service fee 3.5%'), 'card fee shown as a charge')

// ---------- experience ----------
cookie = ''
const exp = { date: day(2), slot: '06:00', pax: 3, pickup_location: 'Hotel X', guest_name: 'Anna K', email: 'anna@example.com', phone: '0771234567', extras: '5' }
r = await post('/book/experience/minneriya-jeep-safari', { form: exp, auth: false })
ok(/^\/b\//.test(r.location), 'safari booked')
for (let i = 0; i < 2; i++) await post('/book/experience/minneriya-jeep-safari', { form: exp, auth: false })
r = await post('/book/experience/minneriya-jeep-safari', { form: exp, auth: false })
ok(r.location.includes('fully%20booked'), 'slot capacity enforced')

// ---------- safari detail page ----------
r = await get('/experiences/minneriya-jeep-safari', { auth: false })
ok(r.status === 200 && r.text.includes('Best time to go') && r.text.includes('How the day goes') && r.text.includes('"FAQPage"'), 'safari detail page with best time, itinerary and FAQ schema')
if (!TAXI) ok(!r.text.includes('href="/taxi"'), 'taxi hidden from navigation')

// ---------- taxi + driver ----------
if (!TAXI) {
  ok((await get('/taxi', { auth: false })).status === 404, 'taxi page hidden (FEATURE_TAXI off)')
  ok((await post('/book/taxi', { form: { x: 1 }, auth: false })).status === 404, 'taxi booking disabled')
  ok(!(await get('/sitemap.xml', { auth: false })).text.includes('/taxi'), 'taxi not in sitemap')
} else {
r = await post('/drivers/join', { form: { name: 'Nimal', phone: '0770000001', nic: '901234567V', licence_no: 'L1', vehicle_type: 'car', vehicle_no: 'CAB-1234' }, auth: false })
ok(r.location.includes('ok=1'), 'driver registered')
r = await post('/book/taxi', { form: { pickup_location: 'Sigiriya', route_id: 3, start: `${day(3)}T08:00`, pax: 2, vehicle_type: 'car', guest_name: 'J Smith', email: 'js@example.com', phone: '0779999999' }, auth: false })
ok(/^\/b\//.test(r.location), 'taxi requested')
const taxiToken = r.location.split('/')[2]
const taxiRef = /MT-\d{4}-\d{4}/.exec((await get(`/b/${taxiToken}`, { auth: false })).text)[0]
cookie = adminCookie
r = await get('/admin/taxi')
const driverId = /\/admin\/taxi\/driver\/(\d+)/.exec(r.text)[1]
await post(`/admin/taxi/driver/${driverId}`, { form: { status: 'approved' } })
r = await get('/admin/taxi')
const driverToken = /\/d\/([\w-]+)/.exec(r.text)?.[1]
ok(driverToken, 'driver approved, link available')
r = await get(`/staff/booking/${taxiRef}`)
ok(r.text.includes('12000') || r.text.includes('12,000'), 'taxi price from route table')
await post(`/staff/booking/${taxiRef}/taxi`, { form: { price: 12000, commission: 1200, driver_id: driverId } })
r = await get(`/d/${driverToken}`, { auth: false })
ok(r.text.includes('Kandy') && r.text.includes('Accept trip'), 'driver sees job offer')
await post(`/d/${driverToken}/job/${taxiRef}`, { form: { action: 'accept' }, auth: false })
await post(`/d/${driverToken}/job/${taxiRef}`, { form: { action: 'done' }, auth: false })
r = await get(`/d/${driverToken}`, { auth: false })
ok(r.text.includes('LKR 1,200'), 'commission added to driver balance')
await post(`/d/${driverToken}/pay`, { multipart: { amount: 1200, slip: img() }, auth: false })
r = await get('/admin/taxi')
const ledgerId = /\/admin\/taxi\/ledger\/(\d+)/.exec(r.text)[1]
await post(`/admin/taxi/ledger/${ledgerId}`, { form: { action: 'confirm' } })
r = await get(`/d/${driverToken}`, { auth: false })
ok(r.text.includes('LKR 0'), 'driver payment confirmed, balance cleared')
}

// ---------- admin pages ----------
cookie = adminCookie
for (const p of ['/admin', '/admin/bookings', '/admin/vehicles', '/admin/experiences', '/admin/taxi', '/admin/finance', '/admin/agreement', '/admin/settings', '/admin/users', '/staff'])
  ok((await get(p)).status === 200, `admin page ${p}`)
r = await get('/admin/finance')
ok(r.text.includes('Card bank fee'), 'bank card fee booked as an expense')
r = await post('/admin/finance/expense', { multipart: { spent_on: day(0), business: 'scooter', category: 'Fuel', amount: 1500, note: 'petrol' } })
ok(r.location.includes('ok='), 'expense saved')
ok((await get(`/admin/finance/export.csv?month=${day(0).slice(0, 7)}`)).text.includes('expense'), 'CSV export')
r = await post('/admin/agreement', { form: { title: 'v3', body: (await get('/admin/agreement')).text.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&') + '\n19. Test clause.' } })
ok(r.location.includes('ok='), 'new agreement version saved')

console.log(`\nAll ${passed} checks passed.`)

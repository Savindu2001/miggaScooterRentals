import { Hono } from 'hono'
import type { AppEnv, Env } from '../lib/env'
import { Page } from '../views/layout'
import { bestPrice, nextFree, type Vehicle } from '../lib/pricing'
import { addDays, fmtDT, getSettings, lkr, nowLocal, permitServiceOn, randomToken, taxiOn, todayLocal, waLink } from '../lib/util'
import { qrGif } from '../lib/qr'

const app = new Hono<AppEnv>()

type Experience = {
  id: number; slug: string; name: string; category: string; summary: string; description: string; includes: string
  price: number; price_per: string; max_pax: number; slots: string; capacity: number; photo: string
  duration: string; highlights: string; best_time: string; itinerary: string; excludes: string; bring: string; faq: string; gallery: string
}
const lines = (s: string) => (s || '').split('\n').map((l) => l.trim()).filter(Boolean)
const pairs = (s: string) => lines(s).map((l) => { const i = l.indexOf('|'); return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
type Route = { id: number; destination: string; km: number; price_car: number; price_van: number }

export const slugify = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const priceText = (n: number, per = '') => (n ? lkr(n) + per : 'Price on request')

function org(env: Env) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Migga',
    url: env.SITE_URL,
    logo: env.SITE_URL + '/img/logo.svg',
    telephone: '+' + env.WHATSAPP,
    sameAs: [env.FACEBOOK_URL, env.INSTAGRAM_URL].filter(Boolean),
  }
}
const place = { '@type': 'PostalAddress', addressLocality: 'Sigiriya', addressRegion: 'Central Province', addressCountry: 'LK' }

// ---------- Home ----------
app.get('/', async (c) => {
  const env = c.env
  return c.html(
    <Page env={env} nav="home" path="/" title={`Migga Sigiriya · Scooter rental, jeep safari${taxiOn(env) ? ", village tours & taxi" : " & village tours"}`}
      description="Book scooters, Minneriya and Kaudulla jeep safaris and village tours in Sigiriya, Sri Lanka. Live availability, online booking, local team."
      jsonld={org(env)}>
      <section class="hero">
        <div class="wrap">
          <div class="copy">
            <div class="eyebrow">Sigiriya · Sri Lanka</div>
            <h1>Explore Sigiriya your way</h1>
            <p class="lead">Rent a scooter, see wild elephants on a jeep safari or meet village life around Sigiriya. Book online in minutes.</p>
            <div class="row">
              <a class="btn" href="/book/scooter">Book a scooter</a>
              <a class="btn ghost" href="/jeep-safari">Jeep safaris</a>
            </div>
          </div>
          <div class="media"><img src="/img/scooter-field.webp" alt="Yellow scooter parked in the fields near Sigiriya" width="680" height="510" fetchpriority="high" /></div>
        </div>
      </section>
      <section class="block">
        <div class="wrap grid">
          <a class="biz" href="/scooter-rental-sigiriya"><b>Scooter Rental</b>From LKR 3,500 per 24 hours, helmets included. Live availability.</a>
          <a class="biz" href="/jeep-safari"><b>Wild Jeep Safari</b>Minneriya, Kaudulla and Hurulu Eco Park, with a free breakfast pack on morning safaris.</a>
          <a class="biz" href="/tours"><b>Village Tours & Activities</b>Village life around Sigiriya with local guides.</a>
          {taxiOn(env) && <a class="biz" href="/taxi"><b>Migga Taxi</b>Fixed prices from Sigiriya to the airport, Kandy, Ella and more.</a>}
        </div>
      </section>
      <section class="block" style="padding-top:0">
        <div class="wrap">
          <h2>Happy riders</h2>
          <div class="gallery">
            <img src="/img/riders-1.webp" alt="Guests on a Migga scooter in Sigiriya" loading="lazy" />
            <img src="/img/sigiriya-road.webp" alt="Scooter on a jungle road near Sigiriya" loading="lazy" />
            <img src="/img/scooter-sigiriya.webp" alt="Scooter with Sigiriya rock in the background" loading="lazy" />
            <img src="/img/riders-2.webp" alt="Guests with helmets ready to ride" loading="lazy" />
          </div>
        </div>
      </section>
    </Page>,
  )
})

// ---------- Scooter rental landing ----------
const SCOOTER_FAQ: [string, string][] = [
  ['Is an International Driving Permit enough to ride a scooter in Sri Lanka?', 'No. You need your home licence with a motorcycle category, a physical International Driving Permit (1949 Convention) and a Sri Lankan recognition permit from the AAC or a DMT temporary licence. The AAC permit can be arranged at the AAC office in Colombo or at the airport counter before you travel to Sigiriya.'],
  ['How much does a scooter cost in Sigiriya?', 'From LKR 3,500 per 24 hours, with helmets and a rain poncho included. Longer rentals get the best package price automatically.'],
  ['Can I pay in cash?', 'Yes. You can pay at the shop in cash, by card or by bank transfer.'],
  ['How do I extend my rental?', 'Open the link in your booking email and request more days. If the scooter is free we confirm straight away.'],
  ['Do you deliver scooters to hotels?', 'Yes, we can deliver and collect in the Sigiriya area. Choose hotel delivery when you book.'],
]

app.get('/scooter-rental-sigiriya', async (c) => {
  const env = c.env
  const now = nowLocal(env)
  const { results: vs } = await env.DB.prepare("SELECT * FROM vehicles WHERE status='active' ORDER BY sort, id").all<Vehicle>()
  const freeInfo = await Promise.all(vs.map((v) => nextFree(env.DB, v.id, now)))
  const minDay = vs.length ? Math.min(...vs.map((v) => v.rate_day)) : 0
  const { results: extras } = await env.DB.prepare("SELECT name, price, per FROM extras WHERE active=1 AND applies_to IN ('scooter','all') ORDER BY sort").all<{ name: string; price: number; per: string }>()
  const start = addDays(todayLocal(env), 1) + 'T09:00'
  const end = addDays(todayLocal(env), 4) + 'T09:00'
  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'AutoRental', name: 'Migga Scooter Rental', url: env.SITE_URL + '/scooter-rental-sigiriya',
      image: env.SITE_URL + '/img/scooter-field.webp', telephone: '+' + env.WHATSAPP, address: place, priceRange: minDay ? `From LKR ${minDay}` : undefined,
      sameAs: [env.FACEBOOK_URL, env.INSTAGRAM_URL, env.GOOGLE_REVIEW_SCOOTER].filter(Boolean),
      makesOffer: vs.map((v) => ({ '@type': 'Offer', name: `${v.name} scooter rental`, price: v.rate_day, priceCurrency: 'LKR', description: 'Per 24 hours' })),
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: SCOOTER_FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ]
  return c.html(
    <Page env={env} nav="scooter" path="/scooter-rental-sigiriya" jsonld={jsonld}
      title={`Scooter Rental in Sigiriya from LKR ${minDay.toLocaleString('en-US')}/day · Migga`}
      description="Rent a scooter in Sigiriya, Sri Lanka. See live availability, upload your documents, sign online and pick up in minutes. Helmets included, hotel delivery available.">
      <section class="hero">
        <div class="wrap">
          <div class="copy">
            <div class="eyebrow">Sigiriya · Sri Lanka</div>
            <h1>Scooter rental in Sigiriya, booked in two minutes</h1>
            <p class="lead">See live availability, upload your documents, sign the agreement online and just pick up your scooter. From {lkr(minDay)} per 24 hours, helmets included.</p>
            <div class="pills"><span>Free helmets</span><span>Hotel delivery</span><span>Cash or card</span></div>
          </div>
          <form class="card stack" style="flex:1 1 360px;color:var(--ink)" method="get" action="/book/scooter">
            <h2 style="font-size:24px">Check availability</h2>
            <div class="grid-2">
              <label>Pickup<input type="datetime-local" name="start" value={start} required /></label>
              <label>Return<input type="datetime-local" name="end" value={end} required /></label>
            </div>
            <button class="btn">Show scooters & prices</button>
          </form>
        </div>
      </section>
      <section class="block">
        <div class="wrap">
          <h2>Our scooters</h2>
          <p class="muted">Longer rentals get the cheapest package automatically.</p>
          <div class="grid">
            {vs.map((v, i) => (
              <article class="card">
                {v.photo && <img class="cover" src={v.photo} alt={`${v.name} scooter for rent in Sigiriya`} loading="lazy" />}
                <div class="row between"><h3 style="margin:0">{v.name}</h3>{freeInfo[i] ? <span class="badge warn">Free from {fmtDT(freeInfo[i])}</span> : <span class="badge ok">Available now</span>}</div>
                <p class="small muted" style="margin:6px 0 0">{v.description}</p>
                <div class="prices">
                  <div><small>1 day</small><b>{v.rate_day.toLocaleString('en-US')}</b></div>
                  <div><small>3 days</small><b>{(v.rate_3day || v.rate_day * 3).toLocaleString('en-US')}</b></div>
                  <div><small>Week</small><b>{(v.rate_week || bestPrice(v, 7).total).toLocaleString('en-US')}</b></div>
                  <div><small>Month</small><b>{(v.rate_month || bestPrice(v, 30).total).toLocaleString('en-US')}</b></div>
                </div>
                <a class="btn dark" style="width:100%" href={`/book/scooter?vehicle=${v.id}`}>Book this scooter</a>
              </article>
            ))}
            <article class="card dark">
              <h3>Extras</h3>
              <ul class="stack" style="list-style:none;padding:0;margin:0">
                {extras.map((e) => (<li class="row between"><span>{e.name}</span><span style="color:#E9C98F">{e.price ? lkr(e.price) + (e.per === 'day' ? '/day' : '') : 'Free'}</span></li>))}
              </ul>
            </article>
          </div>
        </div>
      </section>
      <section class="block" style="padding-top:0">
        <div class="wrap grid">
          <div class="card" style="background:var(--warm);border:0">
            <h2 style="font-size:26px">What you need to ride</h2>
            <ul>
              <li>Your home driving licence with a motorcycle category</li>
              <li>A physical International Driving Permit (1949 Convention). Digital IDPs are not accepted</li>
              <li>A Sri Lankan recognition permit (AAC) or DMT licence{permitServiceOn(env) ? <>. <b>We can arrange it for you.</b></> : ', arranged before pickup'}</li>
              <li>Your passport</li>
            </ul>
          </div>
          <div>
            <h2 style="font-size:26px">Questions</h2>
            {SCOOTER_FAQ.map(([q, a], i) => (<details open={i === 0}><summary>{q}</summary><p class="muted" style="margin:8px 0 0">{a}</p></details>))}
          </div>
        </div>
      </section>
    </Page>,
  )
})

// ---------- Safari & tours ----------
async function experienceList(c: any, cats: string[], nav: 'safari' | 'tours', path: string, title: string, h1: string, intro: string, desc: string) {
  const env: Env = c.env
  const { results } = await env.DB.prepare(`SELECT * FROM experiences WHERE active=1 AND category IN (${cats.map(() => '?').join(',')}) ORDER BY sort, id`).bind(...cats).all<Experience>()
  const jsonld = results.map((e) => ({
    '@context': 'https://schema.org', '@type': 'TouristTrip', name: e.name, description: e.summary, url: `${env.SITE_URL}/experiences/${e.slug}`,
    provider: { '@type': 'TravelAgency', name: nav === 'safari' ? 'Migga Wild Jeep Safari' : 'Migga', address: place, telephone: '+' + env.WHATSAPP },
    offers: e.price ? { '@type': 'Offer', price: e.price, priceCurrency: 'LKR' } : undefined,
  }))
  return c.html(
    <Page env={env} nav={nav} path={path} title={title} description={desc} jsonld={jsonld}>
      <section class="hero"><div class="wrap"><div class="copy"><div class="eyebrow">From Sigiriya</div><h1>{h1}</h1><p class="lead">{intro}</p></div></div></section>
      <section class="block">
        <div class="wrap grid">
          {results.map((e) => (
            <article class="card stack">
              {e.photo && <img class="cover" src={e.photo} alt={e.name} loading="lazy" style="margin:0" />}
              <h3 style="margin:0">{e.name}</h3>
              <p class="muted small" style="margin:0">{e.summary}</p>
              <ul class="small" style="margin:0;padding-left:18px">{e.includes.split('\n').filter(Boolean).map((i) => <li>{i}</li>)}</ul>
              <div class="row between"><b>{priceText(e.price, e.price_per === 'person' ? ' per person' : ' per jeep')}</b><span class="small muted">Starts {e.slots.split(',').join(' or ')}</span></div>
              <div class="row"><a class="btn dark" href={`/experiences/${e.slug}`}>See details</a><a class="btn ghost" href={`/experiences/${e.slug}#book`}>Book</a></div>
            </article>
          ))}
          {!results.length && <p>New experiences coming soon. <a href={waLink(env.WHATSAPP)}>Ask us on WhatsApp</a>.</p>}
        </div>
      </section>
    </Page>,
  )
}

app.get('/jeep-safari', (c) =>
  experienceList(c, ['safari'], 'safari', '/jeep-safari', 'Minneriya, Kaudulla & Eco Park Jeep Safari from Sigiriya · Migga',
    'Jeep safaris from Sigiriya', 'See wild elephants at Minneriya, Kaudulla or Hurulu Eco Park. Private jeep, hotel pickup, and a free breakfast pack on morning safaris.',
    'Book a private jeep safari from Sigiriya to Minneriya, Kaudulla or Hurulu Eco Park. Hotel pickup, morning and afternoon safaris, free breakfast pack.'))
app.get('/tours', (c) =>
  experienceList(c, ['tour', 'activity'], 'tours', '/tours', 'Sigiriya Village Tours & Activities · Migga',
    'Village tours & activities', 'Meet village life around Sigiriya with local guides.', 'Book village tours and local activities in Sigiriya, Sri Lanka with Migga.'))

app.get('/experiences/:slug', async (c) => {
  const env = c.env
  const e = await env.DB.prepare('SELECT * FROM experiences WHERE slug = ? AND active = 1').bind(c.req.param('slug')).first<Experience>()
  if (!e) return c.notFound()
  const { results: extras } = await env.DB.prepare("SELECT id, name, price, per FROM extras WHERE active=1 AND applies_to IN ('experience','all') ORDER BY sort").all<{ id: number; name: string; price: number; per: string }>()
  const { results: others } = await env.DB.prepare('SELECT slug, name, summary, photo, price, price_per FROM experiences WHERE active=1 AND category=? AND id != ? ORDER BY sort LIMIT 3').bind(e.category, e.id).all<Experience>()
  const tomorrow = addDays(todayLocal(env), 1)
  const err = c.req.query('error')
  const isSafari = e.category === 'safari'
  const faq = pairs(e.faq)
  const gallery = pairs(e.gallery)
  const steps = pairs(e.itinerary)
  const per = e.price_per === 'person' ? ' per person' : ' per jeep'
  const url = `${env.SITE_URL}/experiences/${e.slug}`
  const jsonld: object[] = [{
    '@context': 'https://schema.org', '@type': 'TouristTrip', name: e.name, description: e.summary, url,
    image: [e.photo, ...gallery.map(([u]) => u)].filter(Boolean).map((u) => (u.startsWith('http') ? u : env.SITE_URL + u)),
    touristType: isSafari ? 'Wildlife' : 'Culture',
    itinerary: steps.length ? { '@type': 'ItemList', itemListElement: steps.map(([t, d], i) => ({ '@type': 'ListItem', position: i + 1, name: t, description: d })) } : undefined,
    provider: { '@type': 'TravelAgency', name: isSafari ? 'Migga Wild Jeep Safari' : 'Migga', telephone: '+' + env.WHATSAPP, address: place },
    offers: e.price ? { '@type': 'Offer', price: e.price, priceCurrency: 'LKR', url, availability: 'https://schema.org/InStock' } : undefined,
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: env.SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: isSafari ? 'Jeep Safari' : 'Tours', item: env.SITE_URL + (isSafari ? '/jeep-safari' : '/tours') },
      { '@type': 'ListItem', position: 3, name: e.name, item: url },
    ],
  }]
  if (faq.length) jsonld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })
  return c.html(
    <Page env={env} nav={isSafari ? 'safari' : 'tours'} path={`/experiences/${e.slug}`} title={`${e.name} from Sigiriya · ${e.price ? lkr(e.price) + per : 'Book online'} · Migga`}
      description={e.summary} image={e.photo || undefined} jsonld={jsonld}>
      <section class="hero">
        <div class="wrap">
          <div class="copy">
            <div class="eyebrow"><a href={isSafari ? '/jeep-safari' : '/tours'} style="color:inherit">{isSafari ? 'Jeep Safari' : 'Tours & activities'}</a> · From Sigiriya</div>
            <h1>{e.name}</h1>
            <p class="lead">{e.summary}</p>
            <div class="pills">
              {e.duration && <span>{e.duration}</span>}
              <span>Starts {e.slots.split(',').map((x) => x.trim()).join(' or ')}</span>
              <span>Hotel pickup</span>
              {isSafari && <span>Private jeep, up to {e.max_pax} people</span>}
            </div>
          </div>
          {e.photo && <div class="media"><img src={e.photo} alt={e.name} width="680" height="510" fetchpriority="high" /></div>}
        </div>
      </section>
      <section class="block">
        <div class="wrap detail">
          <div class="stack" style="gap:28px">
            {lines(e.highlights).length > 0 && (
              <div><h2>Highlights</h2><ul class="ticks">{lines(e.highlights).map((h) => <li>{h}</li>)}</ul></div>
            )}
            {e.description && <div><h2>About this {isSafari ? 'safari' : 'tour'}</h2>{e.description.split('\n').filter(Boolean).map((p) => <p>{p}</p>)}</div>}
            {e.best_time && <div class="card" style="background:var(--warm);border:0"><h2 style="font-size:22px">Best time to go</h2><p style="margin:0">{e.best_time}</p></div>}
            {steps.length > 0 && (
              <div><h2>How the day goes</h2>
                <ol class="timeline">{steps.map(([t, d]) => <li><b>{t}</b>{d && <span class="muted"> {d}</span>}</li>)}</ol>
              </div>
            )}
            <div class="grid-2">
              {lines(e.includes).length > 0 && <div><h3>Included</h3><ul class="ticks">{lines(e.includes).map((i) => <li>{i}</li>)}</ul></div>}
              {lines(e.excludes).length > 0 && <div><h3>Not included</h3><ul class="crosses">{lines(e.excludes).map((i) => <li>{i}</li>)}</ul></div>}
              {lines(e.bring).length > 0 && <div><h3>What to bring</h3><ul>{lines(e.bring).map((i) => <li>{i}</li>)}</ul></div>}
            </div>
            {gallery.length > 0 && (
              <div><h2>Photos</h2>
                <div class="gallery">{gallery.map(([u, credit]) => <figure style="margin:0"><img src={u} alt={e.name} loading="lazy" />{credit && <figcaption class="tiny muted">{credit}</figcaption>}</figure>)}</div>
              </div>
            )}
            {faq.length > 0 && (
              <div><h2>Questions</h2>{faq.map(([q, a], i) => <details open={i === 0}><summary>{q}</summary><p class="muted" style="margin:8px 0 0">{a}</p></details>)}</div>
            )}
          </div>
          <aside>
            <form class="card stack sticky" method="post" action={`/book/experience/${e.slug}`} id="book">
              <div><b style="font-family:var(--head);font-size:26px">{e.price ? lkr(e.price) : 'Price on request'}</b>{e.price > 0 && <span class="muted">{per}</span>}</div>
              {err && <div class="notice bad">{err}</div>}
              <div class="grid-2">
                <label>Date<input type="date" name="date" min={todayLocal(env)} value={tomorrow} required /></label>
                <label>Start time<select name="slot">{e.slots.split(',').map((x) => <option>{x.trim()}</option>)}</select></label>
                <label>People<input type="number" name="pax" min="1" max={e.max_pax} value="2" required /></label>
                <label>Pickup hotel<input name="pickup_location" placeholder="Hotel in Sigiriya" required /></label>
              </div>
              {extras.length > 0 && <fieldset><legend>Extras</legend>{extras.map((x) => (<label class="check"><input type="checkbox" name="extras" value={String(x.id)} /> {x.name} {x.price ? `(${lkr(x.price)}${x.per === 'person' ? ' per person' : ''})` : '(free)'}</label>))}</fieldset>}
              <label>Full name<input name="guest_name" autocomplete="name" required maxlength={120} /></label>
              <label>Email<input type="email" name="email" autocomplete="email" required /></label>
              <label>Phone / WhatsApp<input type="tel" name="phone" autocomplete="tel" required /></label>
              <label>Notes (optional)<textarea name="notes" maxlength={1000} style="min-height:70px"></textarea></label>
              <button class="btn big">Book now · pay on the day</button>
              <p class="tiny muted" style="margin:0">Pay in cash, or by card (+ card service fee), on the day. Free cancellation up to 24 hours before.</p>
            </form>
          </aside>
        </div>
      </section>
      {others.length > 0 && (
        <section class="block" style="padding-top:0">
          <div class="wrap">
            <h2>{isSafari ? 'Other safaris' : 'More tours'}</h2>
            <div class="grid">{others.map((o) => (
              <a class="card stack" href={`/experiences/${o.slug}`} style="text-decoration:none;color:inherit">
                {o.photo && <img class="cover" src={o.photo} alt={o.name} loading="lazy" style="margin:0" />}
                <b>{o.name}</b><span class="small muted">{o.summary}</span>
              </a>
            ))}</div>
          </div>
        </section>
      )}
    </Page>,
  )
})

// ---------- Taxi ----------
async function taxiData(env: Env) {
  const { results } = await env.DB.prepare('SELECT * FROM taxi_routes WHERE active=1 ORDER BY sort, id').all<Route>()
  return results
}
function TaxiForm(p: { routes: Route[]; selected?: number; env: Env; error?: string }) {
  return (
    <form class="card stack" method="post" action="/book/taxi" style="color:var(--ink)">
      <h2 style="font-size:24px">Book a taxi</h2>
      {p.error && <div class="notice bad">{p.error}</div>}
      <label>Pickup<input name="pickup_location" value="Sigiriya" required /></label>
      <label>Destination
        <select name="route_id">
          {p.routes.map((r) => <option value={String(r.id)} selected={r.id === p.selected}>{r.destination}</option>)}
          <option value="0">Somewhere else (write below)</option>
        </select>
      </label>
      <label>Other destination<input name="destination_other" placeholder="Only if not in the list" /></label>
      <div class="grid-2">
        <label>Date & time<input type="datetime-local" name="start" required /></label>
        <label>Passengers<input type="number" name="pax" min="1" max="14" value="2" required /></label>
        <label>Vehicle<select name="vehicle_type"><option value="car">Car (1–3)</option><option value="van">Van (4–10)</option><option value="tuk">Tuk-tuk (short trips)</option></select></label>
      </div>
      <label>Full name<input name="guest_name" required maxlength={120} /></label>
      <div class="grid-2">
        <label>Email<input type="email" name="email" required /></label>
        <label>Phone / WhatsApp<input type="tel" name="phone" required /></label>
      </div>
      <label>Flight number / notes<input name="notes" maxlength={300} /></label>
      <button class="btn big">Request taxi</button>
      <p class="tiny muted" style="margin:0">You pay the driver at the end of the trip. We confirm your driver by email.</p>
    </form>
  )
}

app.get('/taxi', async (c) => {
  const env = c.env
  if (!taxiOn(env)) return c.notFound()
  const routes = await taxiData(env)
  return c.html(
    <Page env={env} nav="taxi" path="/taxi" title="Taxi from Sigiriya: Airport, Kandy, Ella & more · Fixed prices · Migga Taxi"
      description="Fixed-price taxis from Sigiriya to Colombo airport (BIA), Kandy, Ella, Galle, Trincomalee and more. Book online, pay the driver."
      jsonld={{ '@context': 'https://schema.org', '@type': 'TaxiService', name: 'Migga Taxi', areaServed: 'Sri Lanka', provider: { '@type': 'LocalBusiness', name: 'Migga Taxi', address: place, telephone: '+' + env.WHATSAPP } }}>
      <section class="hero"><div class="wrap"><div class="copy"><div class="eyebrow">Migga Taxi</div><h1>Taxi from Sigiriya at a fixed price</h1><p class="lead">Airport transfers and trips across Sri Lanka with local drivers. Book online and pay the driver.</p></div><div style="flex:1 1 360px"><TaxiForm routes={routes} env={env} error={c.req.query('error')} /></div></div></section>
      <section class="block">
        <div class="wrap">
          <h2>Popular routes from Sigiriya</h2>
          <div class="scroll card"><table class="t">
            <thead><tr><th>Destination</th><th>Distance</th><th>Car</th><th>Van</th><th></th></tr></thead>
            <tbody>{routes.map((r) => (<tr><td><a href={`/taxi/sigiriya-to-${slugify(r.destination)}`}>{r.destination}</a></td><td>{r.km ? `~${r.km} km` : ''}</td><td>{priceText(r.price_car)}</td><td>{priceText(r.price_van)}</td><td><a href={`/taxi/sigiriya-to-${slugify(r.destination)}`}>Book</a></td></tr>))}</tbody>
          </table></div>
        </div>
      </section>
    </Page>,
  )
})

app.get('/taxi/:route{sigiriya-to-[a-z0-9-]+}', async (c) => {
  const env = c.env
  if (!taxiOn(env)) return c.notFound()
  const routes = await taxiData(env)
  const dest = c.req.param('route').replace(/^sigiriya-to-/, '')
  const r = routes.find((x) => slugify(x.destination) === dest)
  if (!r) return c.notFound()
  const q = `How much is a taxi from Sigiriya to ${r.destination}?`
  const a = r.price_car ? `A private car from Sigiriya to ${r.destination} costs ${lkr(r.price_car)} and a van ${lkr(r.price_van)} with Migga Taxi. The trip is about ${r.km} km.` : `Send a request and we quote a fixed price for Sigiriya to ${r.destination} (about ${r.km} km).`
  return c.html(
    <Page env={env} nav="taxi" path={`/taxi/sigiriya-to-${slugify(r.destination)}`} title={`Sigiriya to ${r.destination} Taxi · ${r.price_car ? lkr(r.price_car) : 'Fixed price'} · Migga Taxi`} description={a}
      jsonld={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }] }}>
      <section class="hero"><div class="wrap"><div class="copy"><div class="eyebrow">Migga Taxi</div><h1>Sigiriya to {r.destination} taxi</h1><p class="lead">{a}</p><div class="pills"><span>Fixed price</span><span>Pay the driver</span><span>Local drivers</span></div></div><div style="flex:1 1 360px"><TaxiForm routes={routes} selected={r.id} env={env} /></div></div></section>
    </Page>,
  )
})

// ---------- Driver registration ----------
app.get('/drivers/join', (c) =>
  !taxiOn(c.env) ? c.notFound() : c.html(
    <Page env={c.env} path="/drivers/join" title="Drive with Migga Taxi" description="Register as a Migga Taxi driver in Sigiriya." noindex={false}>
      <section class="block"><div class="wrap" style="max-width:720px">
        <h1 style="font-size:36px">Drive with Migga Taxi</h1>
        <p class="muted">Register once. After we approve you, you get your own link to see and accept trips and track your Migga commission.</p>
        {c.req.query('ok') ? <div class="notice">Thank you! We will check your details and contact you on WhatsApp.</div> : (
          <form class="card stack" method="post" action="/drivers/join">
            <div class="form-grid">
              <label>Full name<input name="name" required maxlength={120} /></label>
              <label>Phone / WhatsApp<input name="phone" type="tel" required /></label>
              <label>Email (optional)<input name="email" type="email" /></label>
              <label>NIC number<input name="nic" required maxlength={20} /></label>
              <label>Driving licence number<input name="licence_no" required maxlength={30} /></label>
              <label>Vehicle type<select name="vehicle_type"><option value="car">Car</option><option value="van">Van</option><option value="tuk">Tuk-tuk</option></select></label>
              <label>Vehicle number<input name="vehicle_no" required maxlength={20} /></label>
              <label>Vehicle model<input name="vehicle_model" maxlength={60} /></label>
            </div>
            <button class="btn big">Register</button>
          </form>
        )}
      </div></section>
    </Page>,
  ),
)

app.post('/drivers/join', async (c) => {
  if (!taxiOn(c.env)) return c.notFound()
  const f = await c.req.parseBody()
  const s = (k: string, n = 120) => String(f[k] ?? '').trim().slice(0, n)
  const vt = ['car', 'van', 'tuk'].includes(s('vehicle_type')) ? s('vehicle_type') : 'car'
  if (!s('name') || !s('phone') || !s('nic') || !s('licence_no') || !s('vehicle_no')) return c.redirect('/drivers/join')
  await c.env.DB.prepare('INSERT INTO drivers (name, phone, email, nic, licence_no, vehicle_type, vehicle_no, vehicle_model, token) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(s('name'), s('phone', 30), s('email'), s('nic', 20), s('licence_no', 30), vt, s('vehicle_no', 20), s('vehicle_model', 60), randomToken(18)).run()
  return c.redirect('/drivers/join?ok=1')
})

// ---------- QR image for emails ----------
app.get('/qr/:file{[A-Za-z0-9_-]+\\.gif}', async (c) => {
  const token = c.req.param('file').replace(/\.gif$/, '')
  const b = await c.env.DB.prepare('SELECT ref FROM bookings WHERE token = ?').bind(token).first<{ ref: string }>()
  if (!b) return c.notFound()
  return c.body(qrGif(`${c.env.SITE_URL}/staff/booking/${b.ref}`, 6), 200, { 'Content-Type': 'image/gif', 'Cache-Control': 'private, max-age=86400' })
})

// ---------- Public images uploaded from admin ----------
app.get('/media/:key{public/.+}', async (c) => {
  const obj = await c.env.BUCKET.get(c.req.param('key'))
  if (!obj) return c.notFound()
  return c.body(obj.body, 200, { 'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' })
})

// ---------- SEO ----------
app.get('/sitemap.xml', async (c) => {
  const env = c.env
  const routes = await taxiData(env)
  const { results: ex } = await env.DB.prepare('SELECT slug FROM experiences WHERE active=1').all<{ slug: string }>()
  const paths = ['/', '/scooter-rental-sigiriya', '/jeep-safari', '/tours', ...ex.map((e) => `/experiences/${e.slug}`),
    ...(taxiOn(env) ? ['/taxi', '/drivers/join', ...routes.map((r) => `/taxi/sigiriya-to-${slugify(r.destination)}`)] : [])]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${env.SITE_URL}${p}</loc></url>`).join('')}</urlset>`
  return c.body(xml, 200, { 'Content-Type': 'application/xml' })
})

app.get('/llms.txt', async (c) => {
  const env = c.env
  const s = await getSettings(env.DB)
  const { results: vs } = await env.DB.prepare("SELECT name, rate_day FROM vehicles WHERE status='active'").all<{ name: string; rate_day: number }>()
  const txt = `# Migga (Sigiriya, Sri Lanka)
> Local business in Sigiriya offering scooter rental, jeep safaris (Minneriya, Kaudulla, Hurulu Eco Park) and village tours.

- Scooter rental: ${vs.map((v) => `${v.name} from LKR ${v.rate_day} per 24 hours`).join('; ')}. Helmets included. Book online: ${env.SITE_URL}/scooter-rental-sigiriya
- Riders need a home licence with motorcycle category, a physical 1949 International Driving Permit and a Sri Lankan AAC recognition permit or DMT licence.
- Jeep safaris: ${env.SITE_URL}/jeep-safari
- Village tours: ${env.SITE_URL}/tours
${taxiOn(env) ? `- Taxi with fixed prices from Sigiriya: ${env.SITE_URL}/taxi\n` : ''}- Contact: WhatsApp +${env.WHATSAPP}. Address: ${s.shop_address || 'Sigiriya, Sri Lanka'}
`
  return c.text(txt)
})

export default app

import type { Child } from 'hono/jsx'
import { raw } from 'hono/html'
import type { Env, User } from '../lib/env'
import { taxiOn, waLink } from '../lib/util'

type PageProps = {
  env: Env
  title: string
  description?: string
  path?: string
  nav?: 'scooter' | 'safari' | 'tours' | 'taxi' | 'home' | ''
  jsonld?: object | object[]
  noindex?: boolean
  image?: string
  children: Child
}

const FONTS = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;600&display=swap'

function Head(p: { env: Env; title: string; description?: string; path?: string; noindex?: boolean; image?: string; jsonld?: object | object[] }) {
  const url = p.env.SITE_URL + (p.path || '/')
  const img = p.env.SITE_URL + (p.image || '/img/scooter-field.webp')
  return (
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{p.title}</title>
      {p.description && <meta name="description" content={p.description} />}
      {p.noindex ? <meta name="robots" content="noindex, nofollow" /> : <link rel="canonical" href={url} />}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={p.title} />
      {p.description && <meta property="og:description" content={p.description} />}
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta name="theme-color" content="#17241C" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
      <link rel="stylesheet" href={FONTS} />
      <link rel="stylesheet" href="/css/app.css?v=4" />
      {p.jsonld && <script type="application/ld+json">{raw(JSON.stringify(p.jsonld).replace(/</g, '\\u003c'))}</script>}
    </head>
  )
}

export function Page(p: PageProps) {
  const env = p.env
  const on = (k: string) => (p.nav === k ? 'on' : '')
  return (
    <html lang="en">
      <Head {...p} />
      <body>
        <header class="top">
          <div class="wrap">
            <a class="brand" href="/" aria-label="Migga home">
              <img src="/img/logo.svg" alt="" width="40" height="34" />
              migga
            </a>
            <nav class="nav" aria-label="Main">
              <a class={on('scooter')} href="/scooter-rental-sigiriya">Scooter Rental</a>
              <a class={on('safari')} href="/jeep-safari">Jeep Safari</a>
              <a class={on('tours')} href="/tours">Village Tours</a>
              {taxiOn(env) && <a class={on('taxi')} href="/taxi">Taxi</a>}
            </nav>
            <a class="btn sm" href="/book/scooter">Book a scooter</a>
          </div>
        </header>
        <main>{p.children}</main>
        <footer class="site">
          <div class="wrap">
            <div>
              <a class="brand" href="/"><img src="/img/logo.svg" alt="" width="40" height="34" />migga</a>
              <p class="mt">Scooter rental, jeep safaris and village tours from Sigiriya, Sri Lanka.</p>
            </div>
            <div class="stack">
              <b>Book</b>
              <a href="/scooter-rental-sigiriya">Scooter rental Sigiriya</a>
              <a href="/jeep-safari">Minneriya, Kaudulla & Eco Park safari</a>
              <a href="/tours">Village tours & activities</a>
              {taxiOn(env) && <a href="/taxi">Taxi from Sigiriya</a>}
            </div>
            <div class="stack">
              <b>Contact</b>
              <a href={waLink(env.WHATSAPP)}>WhatsApp {env.BUSINESS_PHONE}</a>
              {env.FACEBOOK_URL && <a href={env.FACEBOOK_URL} rel="me">Facebook</a>}
              {env.INSTAGRAM_URL && <a href={env.INSTAGRAM_URL} rel="me">Instagram</a>}
              {taxiOn(env) && <a href="/drivers/join">Drive with Migga</a>}
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}

/** Plain page for booking steps / guest pages (no marketing chrome, not indexed). */
export function GuestPage(p: { env: Env; title: string; children: Child; wide?: boolean }) {
  return (
    <html lang="en">
      <Head env={p.env} title={p.title + ' · Migga'} noindex />
      <body>
        <header class="top">
          <div class="wrap">
            <a class="brand" href="/"><img src="/img/logo.svg" alt="" width="40" height="34" />migga</a>
            <span style="flex:1"></span>
            <a class="btn sm ghost" href={waLink(p.env.WHATSAPP)}>WhatsApp</a>
          </div>
        </header>
        <main class="wrap" style={`max-width:${p.wide ? 1000 : 720}px;padding-top:24px;padding-bottom:40px`}>{p.children}</main>
      </body>
    </html>
  )
}

const ADMIN_NAV: [string, string, boolean][] = [
  ['/staff', 'Shop today', false],
  ['/admin', 'Dashboard', true],
  ['/admin/bookings', 'Bookings', false],
  ['/admin/vehicles', 'Scooters & partners', true],
  ['/admin/experiences', 'Safari & tours', true],
  ['/admin/taxi', 'Taxi & drivers', true],
  ['/admin/finance', 'Finance', true],
  ['/admin/agreement', 'Agreement', true],
  ['/admin/settings', 'Prices & settings', true],
  ['/admin/users', 'Staff logins', true],
]

export function AdminPage(p: { env: Env; title: string; user: User; path: string; children: Child }) {
  return (
    <html lang="en">
      <Head env={p.env} title={p.title + ' · Migga admin'} noindex />
      <body>
        <div class="app">
          <nav class="side" aria-label="Admin">
            <a class="brand" href="/staff"><img src="/img/logo.svg" alt="" width="36" height="30" />migga</a>
            {ADMIN_NAV.filter(([, , adminOnly]) => !adminOnly || p.user.role === 'admin').map(([href, label]) => (
              <a href={href} class={p.path === href || (href !== '/admin' && href !== '/staff' && p.path.startsWith(href)) ? 'on' : ''}>
                {label}
              </a>
            ))}
            <span style="flex:1"></span>
            <form method="post" action="/logout">
              <button class="btn ghost sm" style="width:100%">Log out ({p.user.name})</button>
            </form>
          </nav>
          <div class="main">{p.children}</div>
        </div>
        <div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="Preview">
          <div class="lb-bar">
            <span class="lb-title" id="lb-title"></span>
            <button type="button" class="btn ghost sm" data-lb="prev" aria-label="Previous">‹</button>
            <button type="button" class="btn ghost sm" data-lb="next" aria-label="Next">›</button>
            <button type="button" class="btn ghost sm" data-lb="rotate">Rotate</button>
            <button type="button" class="btn ghost sm" data-lb="zoom">Zoom</button>
            <a class="btn ghost sm" id="lb-open" target="_blank" rel="noopener">Open</a>
            <button type="button" class="btn sm" data-lb="close">Close</button>
          </div>
          <div class="lb-stage" id="lb-stage"></div>
        </div>
        <div class="lightbox" id="camera" hidden role="dialog" aria-modal="true" aria-label="Camera">
          <div class="lb-bar"><span class="lb-title" id="cam-title">Camera</span><button type="button" class="btn ghost sm" data-camx="switch">Switch camera</button><button type="button" class="btn sm" data-camx="close">Close</button></div>
          <div class="lb-stage"><video id="cam-video" playsinline autoplay muted></video><img id="cam-shot" alt="" hidden /></div>
          <div class="cam-actions">
            <button type="button" class="btn big" data-camx="shoot">Take photo · ඡායාරූපය ගන්න</button>
            <button type="button" class="btn ghost" data-camx="retake" hidden>Retake</button>
            <button type="button" class="btn green big" data-camx="use" hidden>Use photo</button>
          </div>
        </div>
        <div class="lightbox" id="qrscan" hidden role="dialog" aria-modal="true" aria-label="Scan QR code">
          <div class="lb-bar"><span class="lb-title">Scan booking QR · QR ස්කෑන් කරන්න</span><button type="button" class="btn ghost sm" data-qrx="switch">Switch camera</button><button type="button" class="btn sm" data-qrx="close">Close</button></div>
          <div class="lb-stage qr-stage"><video id="qr-video" playsinline autoplay muted></video><div class="qr-frame" aria-hidden="true"></div></div>
          <p class="qr-msg" id="qr-msg" role="status">Point the camera at the QR code</p>
        </div>
        <script src="/js/staff.js?v=3" defer></script>
      </body>
    </html>
  )
}

export function Flash(p: { msg?: string | null; kind?: 'ok' | 'warn' | 'bad' }) {
  if (!p.msg) return null
  return <div class={`notice ${p.kind && p.kind !== 'ok' ? p.kind : ''}`} role="status">{p.msg}</div>
}

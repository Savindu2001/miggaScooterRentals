import { WorkerMailer } from 'worker-mailer'
import type { Env } from './env'
import type { Booking, BookingExtra, Money } from './bookings'
import { fmtDT, lkr, permitServiceOn, taxiOn, waLink } from './util'

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Send one email through Gmail SMTP. Never throws: failures are logged so a booking is never lost. */
export async function sendMail(env: Env, to: string, subject: string, html: string): Promise<boolean> {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    console.log(`[mail skipped: GMAIL_USER/GMAIL_APP_PASSWORD not set] to=${to} subject=${subject}`)
    return false
  }
  try {
    await WorkerMailer.send(
      {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        authType: 'plain',
        credentials: { username: env.GMAIL_USER, password: env.GMAIL_APP_PASSWORD },
      },
      {
        from: { name: env.MAIL_FROM_NAME || 'Migga', email: env.GMAIL_USER },
        to: { email: to },
        subject,
        html,
        text: html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      },
    )
    return true
  } catch (e) {
    console.error('mail failed', to, subject, e)
    return false
  }
}

// ---------- building blocks (table layout + inline styles for email clients) ----------
const C = { ink: '#17241C', green: '#1F4D35', amber: '#E09A2B', sand: '#F5F1E8', line: '#E4DDCD', muted: '#5B6660', warm: '#FBEBD2' }

function layout(env: Env, opts: { tag: string; eyebrow: string; title: string; intro: string; body: string; hero?: string }) {
  const site = env.SITE_URL
  const social = [
    `<a href="${esc(waLink(env.WHATSAPP))}" style="color:#F5F1E8;text-decoration:none;border:1px solid #3C4D42;border-radius:99px;padding:6px 12px;display:inline-block;margin:0 6px 6px 0">WhatsApp ${esc(env.BUSINESS_PHONE)}</a>`,
    env.FACEBOOK_URL && `<a href="${esc(env.FACEBOOK_URL)}" style="color:#F5F1E8;text-decoration:none;border:1px solid #3C4D42;border-radius:99px;padding:6px 12px;display:inline-block;margin:0 6px 6px 0">Facebook</a>`,
    env.INSTAGRAM_URL && `<a href="${esc(env.INSTAGRAM_URL)}" style="color:#F5F1E8;text-decoration:none;border:1px solid #3C4D42;border-radius:99px;padding:6px 12px;display:inline-block;margin:0 6px 6px 0">Instagram</a>`,
  ].filter(Boolean).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#EDE8DC;font-family:Arial,Helvetica,sans-serif;color:${C.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDE8DC;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:${C.ink};padding:18px 28px"><table width="100%" role="presentation"><tr>
<td><img src="${site}/img/logo-email.png" width="34" height="28" alt="" style="vertical-align:middle"> <span style="font-weight:bold;font-size:20px;color:${C.sand};vertical-align:middle">migga</span></td>
<td align="right" style="font-size:13px;color:#DDE6DF">${esc(opts.tag)}</td></tr></table></td></tr>
${opts.hero || ''}
<tr><td style="padding:28px 28px 18px">
<div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${C.green};font-weight:bold;margin-bottom:6px">${esc(opts.eyebrow)}</div>
<div style="font-size:24px;font-weight:bold;line-height:1.25;margin-bottom:10px">${esc(opts.title)}</div>
<div style="font-size:15px;line-height:1.6;color:${C.muted}">${opts.intro}</div></td></tr>
${opts.body}
<tr><td style="background:${C.ink};color:#DDE6DF;padding:20px 28px;font-size:13px;line-height:1.7">${social}<br>
Also from Migga: <a href="${site}/jeep-safari" style="color:#E9C98F">Jeep Safari</a> · <a href="${site}/tours" style="color:#E9C98F">Village Tours</a>${taxiOn(env) ? ` · <a href="${site}/taxi" style="color:#E9C98F">Taxi</a>` : ''} · <a href="${site}/scooter-rental-sigiriya" style="color:#E9C98F">Scooters</a><br>
Migga, Sigiriya, Sri Lanka · <a href="${site}" style="color:#E9C98F">${esc(site.replace(/^https?:\/\//, ''))}</a></td></tr>
</table></td></tr></table></body></html>`
}

const row = (k: string, v: string, strong = false) =>
  `<tr><td style="padding:6px 0;color:${C.muted};font-size:14px">${esc(k)}</td><td align="right" style="padding:6px 0;font-size:14px;${strong ? 'font-weight:bold' : ''}">${v}</td></tr>`
const section = (title: string, inner: string, bg = '#fff') =>
  `<tr><td style="padding:18px 28px;border-top:1px solid ${C.line};background:${bg}">${title ? `<div style="font-weight:bold;font-size:16px;margin-bottom:8px">${esc(title)}</div>` : ''}${inner}</td></tr>`
const table = (rows: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`
const button = (href: string, label: string, dark = false) =>
  `<a href="${esc(href)}" style="display:inline-block;background:${dark ? C.ink : C.amber};color:${dark ? C.sand : C.ink};text-decoration:none;font-weight:bold;font-size:14px;padding:13px 18px;border-radius:10px;margin:0 8px 8px 0">${esc(label)}</a>`

function priceRows(b: Booking, extras: BookingExtra[], m?: Money) {
  let r = row(b.kind === 'scooter' ? 'Rental' : b.kind === 'taxi' ? 'Trip' : 'Price', b.rental_price ? lkr(b.rental_price) : 'We will confirm')
  for (const e of extras) r += row(`${e.name}${e.qty > 1 ? ' ×' + e.qty : ''}`, e.total ? lkr(e.total) : 'Free')
  r += row('Total', b.total ? lkr(b.total) : 'To be confirmed', true)
  if (m && m.paid) r += row('Paid', lkr(m.paid))
  if (m && m.balance > 0 && b.total) r += row('To pay (cash, or card + card fee)', lkr(m.balance), true)
  if (b.deposit) r += row('Refundable security deposit', lkr(b.deposit))
  return r
}

// ---------- templates ----------
export function scooterConfirmedEmail(env: Env, b: Booking, extras: BookingExtra[], m: Money, s: Record<string, string>) {
  const site = env.SITE_URL
  const body =
    section('', `<table role="presentation"><tr><td><img src="${site}/qr/${b.token}.gif" width="150" height="150" alt="Check-in QR code ${esc(b.ref)}" style="display:block;border:1px solid ${C.line}"></td>
<td style="padding-left:20px;font-size:14px;line-height:1.6;color:${C.muted}">Booking reference<br><span style="font-size:22px;font-weight:bold;color:${C.ink};letter-spacing:1px">${esc(b.ref)}</span><br>
Pickup at <b style="color:${C.ink}">${esc(b.pickup_location || s.shop_address)}</b><br>${esc(fmtDT(b.start_at))}</td></tr></table>`) +
    section('Your booking', table(row('Scooter', `${esc(b.vehicle_name)} · ${esc(b.plate)}`) + row('Return', esc(fmtDT(b.end_at))) + priceRows(b, extras, m))) +
    section('Bring with you', `<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8"><li>Your passport</li><li>Your home driving licence and <b>physical</b> International Driving Permit</li>${Number(s.card_fee_pct) > 0 ? `<li>Paying by card? A ${esc(s.card_fee_pct)}% card service fee charged by the bank is added. Cash has no fee.</li>` : ''}<li>${b.permit_option === 'arrange' && permitServiceOn(env) ? 'We will hand you your AAC permit at pickup' : 'Your Sri Lankan AAC recognition permit or DMT licence'}</li></ul>`, '#FBF7EE') +
    section('', button(s.maps_url || `https://www.google.com/maps/search/?api=1&query=Migga+Scooter+Rental+Sigiriya`, 'Get directions') + button(`${site}/b/${b.token}/agreement`, 'Signed agreement', true) +
      `<div style="font-size:14px"><a href="${site}/b/${b.token}" style="color:${C.green};font-weight:bold">Manage booking or request an extension</a></div>`)
  return layout(env, {
    tag: 'Scooter Rental · Sigiriya', eyebrow: 'Booking confirmed', title: `Your scooter is reserved, ${b.guest_name.split(' ')[0]}`,
    intro: 'Show the QR code below at the Migga shop. We check the scooter with you and you are on the road in about 10 minutes.', body,
  })
}

export function experienceConfirmedEmail(env: Env, b: Booking, extras: BookingExtra[], m: Money) {
  const includes = (b.experience_includes || '').split('\n').filter(Boolean)
  const body =
    section('', `<table role="presentation" width="100%" style="background:${C.warm};border-radius:12px"><tr><td style="padding:14px 16px;color:#8A4B08;font-size:13px">Pickup<br><b style="font-size:16px">${esc(fmtDT(b.start_at))}</b></td><td style="padding:14px 16px;color:#8A4B08;font-size:13px">From<br><b style="font-size:16px">${esc(b.pickup_location || 'To be confirmed')}</b></td></tr></table>`) +
    section('Your booking', table(row('Guests', String(b.pax)) + priceRows(b, extras, m))) +
    (includes.length ? section('Included', `<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8">${includes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`, '#FBF7EE') : '') +
    section('', `<div style="font-size:14px;line-height:1.6;color:${C.muted};margin-bottom:10px">We send your driver's name, phone and vehicle number the evening before.</div>` + button(`${env.SITE_URL}/b/${b.token}`, 'View or change booking', true))
  return layout(env, {
    tag: b.experience_category === 'safari' ? 'Wild Jeep Safari' : 'Tours & Activities', eyebrow: `Confirmed · ${b.ref}`,
    title: `${b.experience_name} for ${b.pax}`, intro: 'Thank you for booking with Migga. Here are your details.', body,
  })
}

export function taxiEmail(env: Env, b: Booking, stage: 'received' | 'confirmed') {
  const body =
    section('Your trip', table(row('From', esc(b.pickup_location)) + row('To', esc(b.destination)) + row('Pickup', esc(fmtDT(b.start_at))) +
      row('Passengers', String(b.pax)) + row('Vehicle', esc(b.vehicle_type)) + row('Price', b.total ? lkr(b.total) + ' · pay the driver' : 'We will send the price shortly', true) +
      (stage === 'confirmed' && b.driver_name ? row('Driver', `${esc(b.driver_name)} · ${esc(b.driver_phone)}`, true) : ''))) +
    section('', button(`${env.SITE_URL}/b/${b.token}`, 'View booking', true))
  return layout(env, {
    tag: 'Migga Taxi', eyebrow: stage === 'received' ? `Request received · ${b.ref}` : `Driver confirmed · ${b.ref}`,
    title: stage === 'received' ? 'We got your taxi request' : `Your driver is ${b.driver_name}`,
    intro: stage === 'received' ? 'We will confirm the price and your driver soon, usually within an hour.' : 'Your driver will meet you at the pickup point. Pay the driver at the end of the trip.',
    body,
  })
}

export function pickupEmail(env: Env, b: Booking, insp: { km: number | null; fuel: string; items: string; notes: string }, photoCount: number) {
  const body =
    section('', `<table role="presentation" width="100%" style="background:${C.warm};border-radius:12px"><tr><td style="padding:14px 16px;color:#8A4B08">Return by<br><b style="font-size:18px">${esc(fmtDT(b.end_at))}</b></td><td align="right" style="padding:14px 16px">${button(`${env.SITE_URL}/b/${b.token}`, 'Extend rental', true)}</td></tr></table>`) +
    section('Scooter condition at pickup', table(row('Odometer', insp.km != null ? `${insp.km.toLocaleString('en-US')} km` : '—') + row('Fuel', esc(insp.fuel || '—') + ' (please return the same)') +
      row('Handed over', esc(insp.items || '—')) + row('Existing marks', esc(insp.notes || 'None noted')) + row('Photos on file', String(photoCount)))) +
    section('In an emergency', `<div style="font-size:14px;line-height:1.7">Accident: call the police on 119 if anyone is hurt, then WhatsApp us on ${esc(env.BUSINESS_PHONE)}.<br>Breakdown: call us. Please do not repair the scooter yourself.</div>`, '#FBF7EE')
  return layout(env, { tag: b.ref, eyebrow: 'Pickup receipt', title: `Enjoy the ride, ${b.guest_name.split(' ')[0]}`, intro: "Here's the scooter's condition when you picked it up, so we both have the same record.", body })
}

export function returnEmail(env: Env, b: Booking, charges: { description: string; amount: number }[], m: Money, refund: number) {
  let r = row('Rental and extras', lkr(b.total))
  for (const ch of charges) r += row(ch.description, lkr(ch.amount))
  r += row('Total', lkr(m.due), true) + row('Paid', lkr(m.paid))
  const body =
    section('Final bill', table(r)) +
    section('', `<table role="presentation" width="100%" style="background:#E6EFE8;border-radius:12px"><tr><td style="padding:16px;color:${C.green}">Deposit refunded<br><b style="font-size:22px">${lkr(refund)}</b></td></tr></table>
<div style="font-size:13px;color:${C.muted};margin-top:12px;line-height:1.6">Charges follow the damage price list in the agreement you signed. Questions? Reply to this email within 7 days.</div>`)
  return layout(env, { tag: b.ref, eyebrow: 'Rental closed', title: `Thanks for riding with Migga, ${b.guest_name.split(' ')[0]}`, intro: `Your scooter was returned on ${esc(fmtDT(b.actual_return_at))}.`, body })
}

export function extensionEmail(env: Env, b: Booking, newEnd: string, amount: number, approved: boolean) {
  const body =
    section('', table(row('Old return', esc(fmtDT(b.end_at))) + row('New return', esc(fmtDT(newEnd)), true) + row('Extra cost', lkr(amount), true))) +
    section('', `<div style="font-size:14px;color:${C.muted}">${approved ? 'Pay at the shop when you return (cash, or card + card fee).' : 'We check the scooter is free and confirm by email shortly.'}</div>`)
  return layout(env, {
    tag: b.ref, eyebrow: approved ? 'Extension approved' : 'Extension requested',
    title: approved ? `Keep riding: new return ${fmtDT(newEnd)}` : 'We got your extension request', intro: '', body,
  })
}

export function reviewEmail(env: Env, b: Booking) {
  const link = b.kind === 'scooter' ? env.GOOGLE_REVIEW_SCOOTER : b.kind === 'taxi' ? env.GOOGLE_REVIEW_TAXI : env.GOOGLE_REVIEW_SAFARI
  const name = b.kind === 'scooter' ? 'Migga Scooter Rental' : b.kind === 'taxi' ? 'Migga Taxi' : 'Migga Wild Jeep Safari'
  const body =
    section('', `<div style="text-align:center">${link ? button(link, `Review ${name} on Google`) : ''}</div>` +
      (env.INSTAGRAM_URL ? `<div style="font-size:14px;line-height:1.6;margin-top:10px;text-align:center">Got photos? Tag us on <a href="${esc(env.INSTAGRAM_URL)}" style="color:${C.green}">Instagram</a>.</div>` : ''))
  return layout(env, { tag: name, eyebrow: 'Thank you', title: `How was your time with Migga, ${b.guest_name.split(' ')[0]}?`, intro: 'We are a small local business in Sigiriya. A short Google review takes one minute and helps other travellers find us.', body })
}

export function adminAlertEmail(env: Env, b: Booking, what: string) {
  const body = section('', table(row('Guest', `${esc(b.guest_name)} · ${esc(b.phone)}`) + row('When', esc(fmtDT(b.start_at))) + row('Total', b.total ? lkr(b.total) : 'needs a price', true)) +
    `<div style="margin-top:12px">${button(`${env.SITE_URL}/admin/bookings/${b.id}`, 'Open in admin', true)}</div>`)
  return layout(env, { tag: 'Admin', eyebrow: b.ref, title: what, intro: '', body })
}

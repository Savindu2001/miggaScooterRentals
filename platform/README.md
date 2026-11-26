# Migga platform

One small, fast web app for **Migga Scooter Rental, Migga Wild Jeep Safari, village tours and Migga Taxi** (Sigiriya, Sri Lanka).

- **Website** (SEO / AEO / GEO): scooter rental, jeep safari, tours, taxi + a page per taxi route, schema.org data, sitemap, `llms.txt`
- **Online booking**: live scooter availability, day / 3-day / week / month pricing (cheapest combination picked automatically), extras, document upload, e-signed agreement, QR code
- **Shop tablet** (`/staff`): scan the guest's QR code, check documents, take payments (cash / card / bank / online), pickup and return inspections with photos, damage price list, late fees, deposit refund
- **Admin** (`/admin`): bookings, scooters and partner bikes, safaris and tours, taxi routes / drivers / commission, agreement editor (versioned), prices and rules, staff logins, finance (income, expenses, profit per business, CSV export)
- **Drivers** (`/drivers/join`, `/d/<link>`): drivers register, accept trips, mark them done, see what they owe Migga and upload payment slips
- **Emails** via Gmail: booking confirmation with QR, pickup receipt, return invoice, extension, safari/taxi confirmations, review request (to the right Google profile), admin alerts
- **Daily job** (09:00 Sri Lanka): review emails, deletes guest documents after the retention period, cancels unfinished bookings

**Stack:** Cloudflare Workers + [Hono](https://hono.dev) (server-rendered pages, no frontend framework), **D1** database, **R2** private file storage. Gzipped bundle ≈ 90 KB. No Docker needed.

## Folders

```
src/index.tsx          app entry: security, login, setup, daily job
src/routes/public.tsx  website pages, sitemap, llms.txt
src/routes/booking.tsx scooter / safari / taxi booking, documents, signing, guest page
src/routes/staff.tsx   shop tablet: booking page, payments, inspections, returns
src/routes/admin.tsx   admin panel
src/routes/driver.tsx  driver portal
src/lib/               pricing, auth, email templates, files, QR, helpers
src/views/             page layouts
public/                CSS, JS (signature pad), images, logo
migrations/            database schema (0001) and starter data (0002)
scripts/e2e.mjs        end-to-end test (58 checks; 61 with TAXI=on)
```

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars        # fill in later; email is skipped while empty
npm run db:migrate:local
npm run dev                           # http://127.0.0.1:8787
```

Open `http://127.0.0.1:8787/setup` once to create the owner login.

Test everything (fresh local database):

```bash
rm -rf .wrangler && npm run db:migrate:local && npm run dev   # terminal 1
npm test                                                      # terminal 2
```

## Environment

Public settings live in `wrangler.toml` under `[vars]` (site URL, phone, WhatsApp, Facebook, Instagram, Google review links).

Secrets (never commit them):

| Name | What |
| --- | --- |
| `SESSION_SECRET` | long random string, e.g. `openssl rand -hex 32` |
| `GMAIL_USER` | the Gmail / Google Workspace address that sends emails |
| `GMAIL_APP_PASSWORD` | Google App Password (Google Account → Security → 2-Step Verification → App passwords) |
| `ADMIN_NOTIFY_EMAIL` | where new-booking alerts go |

Locally they go in `.dev.vars`. In production: `npx wrangler secret put NAME`.

## Deploy to Cloudflare (about 15 minutes)

```bash
npx wrangler login
npx wrangler d1 create migga            # copy the database_id into wrangler.toml
npx wrangler r2 bucket create migga-files
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GMAIL_USER
npx wrangler secret put GMAIL_APP_PASSWORD
npx wrangler secret put ADMIN_NOTIFY_EMAIL
npm run db:migrate:remote
npm run deploy
```

Then:

1. Buy `migga.lk`, add it to Cloudflare, and in **Workers & Pages → migga → Settings → Domains & Routes** add `migga.lk` and `www.migga.lk`.
2. Open `https://migga.lk/setup` and create the owner login (works only while there are no users).
3. In **Admin → Scooters**, set the real 3-day / week / month prices, deposit and photos. Set the second scooter's name and plate.
4. In **Admin → Prices & settings**, set the damage price list, late fee, fuel charge, permit service price, shop Google Maps link.
5. In **Admin → Safari & tours** and **Admin → Taxi**, set prices (0 shows "Price on request").
6. Put the Facebook, Instagram and the three Google review links in `wrangler.toml` `[vars]`, then `npm run deploy` again.
7. In **Admin → Staff logins**, create a login for the shop tablet.
8. Submit `https://migga.lk/sitemap.xml` in Google Search Console, and set each Google Business Profile's website to its page.

Database backups: D1 keeps 30 days of point-in-time history (`npx wrangler d1 time-travel`).

## Feature switches

In `wrangler.toml` under `[vars]`:

- `FEATURE_TAXI = "off"` hides the taxi pages, taxi booking and driver sign-up from the website (admin still works). Set to `"on"` when the taxi service is ready.
- `FEATURE_PERMIT_SERVICE = "off"` hides the "Migga arranges your AAC permit" option. Set to `"on"` when you offer it.

Run `npm run deploy` after changing them.

## Notes

- Email uses `worker-mailer` (SMTP over Cloudflare TCP sockets) with the Gmail App Password. Nodemailer does not run on Workers.
- Card payments at the shop add a card service fee (default 3.5%, set in Admin → Prices & settings). The fee is grossed up so Migga receives the full amount after the bank's cut, and the bank's cut is booked as a "Card bank fee" expense automatically.
- Online card payment (PayHere) is not connected yet. Guests pay at the shop, by bank transfer, or staff record online payments manually.
- Guest documents are private in R2 and only visible to logged-in staff.

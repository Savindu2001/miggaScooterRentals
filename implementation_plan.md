# Migga Scooter Rental — Production-Ready NestJS Backend

## Overview

Build a complete, production-ready backend for the Migga scooter rental company on top of the existing empty NestJS scaffold located at `/Users/savindusenanayake/Projects/Migga/backend`. The project uses NestJS 11, Prisma ORM, PostgreSQL (Supabase), JWT Auth, RBAC, PayPal, Gmail SMTP, WhatsApp Cloud API, QR codes, PDFs, and file uploads.

---

## Open Questions

> [!IMPORTANT]
> Please review and answer the following before I begin coding:

1. **PayPal Mode**: Should the app start in `sandbox` mode by default, or should both modes be supported at runtime via an env toggle (e.g., `PAYPAL_MODE=sandbox|live`)?
2. **WhatsApp Business API**: Do you have a WhatsApp Cloud API token and phone number ID already? (The service will be built regardless — just confirming so placeholder values are used correctly.)
3. **Supabase DB URL**: The `.env` will include a `DATABASE_URL` placeholder. Will you supply the Supabase connection string separately?
4. **Admin Seeding**: Should an initial admin user be seeded via a Prisma seed script, or do you want a one-time `POST /auth/setup` endpoint?
5. **Booking ID Sequence**: The format `MS-001-YYYYMMDD` — does the sequence (`001`) reset daily, or is it a global auto-incrementing counter?
6. **Agreement PDF**: Where does the PDF come from — admin uploads a master template (stored in uploads/agreements/), or is a PDF generated per booking from a template?

> [!NOTE]
> I will make sensible defaults for all of the above and document them clearly, but please confirm if you want different behavior.

---

## Proposed Architecture

```
backend/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── main.ts                         # Bootstrap + Swagger
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/                 # @Roles(), @Public(), @CurrentUser()
│   │   ├── filters/                    # GlobalExceptionFilter
│   │   ├── guards/                     # JwtAuthGuard, RolesGuard
│   │   ├── interceptors/               # TransformInterceptor, LoggingInterceptor
│   │   ├── pipes/                      # ValidationPipe config
│   │   └── utils/                      # booking-id.util, qr.util, pdf.util
│   ├── config/
│   │   └── configuration.ts            # typed config factory
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts          # POST /auth/login, POST /auth/customer-access
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── local.strategy.ts
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       └── customer-access.dto.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts         # Admin: CRUD users (staff management)
│   │   ├── users.service.ts
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       └── update-user.dto.ts
│   ├── scooters/
│   │   ├── scooters.module.ts
│   │   ├── scooters.controller.ts      # Full CRUD + image upload
│   │   ├── scooters.service.ts
│   │   └── dto/
│   │       ├── create-scooter.dto.ts
│   │       └── update-scooter.dto.ts
│   ├── bookings/
│   │   ├── bookings.module.ts
│   │   ├── bookings.controller.ts
│   │   ├── bookings.service.ts
│   │   └── dto/
│   │       ├── create-booking.dto.ts
│   │       ├── update-booking.dto.ts
│   │       ├── verify-qr.dto.ts
│   │       └── customer-access.dto.ts
│   ├── payments/
│   │   ├── payments.module.ts
│   │   ├── payments.controller.ts      # Create order, capture, webhook
│   │   ├── payments.service.ts
│   │   └── dto/
│   │       └── create-payment.dto.ts
│   ├── expenses/
│   │   ├── expenses.module.ts
│   │   ├── expenses.controller.ts
│   │   ├── expenses.service.ts
│   │   └── dto/
│   │       ├── create-expense.dto.ts
│   │       └── update-expense.dto.ts
│   ├── extensions/
│   │   ├── extensions.module.ts
│   │   ├── extensions.controller.ts    # Request, approve, reject
│   │   ├── extensions.service.ts
│   │   └── dto/
│   │       ├── create-extension.dto.ts
│   │       └── update-extension.dto.ts
│   ├── delivery/
│   │   ├── delivery.module.ts
│   │   ├── delivery.controller.ts      # CRUD delivery zones
│   │   ├── delivery.service.ts
│   │   └── dto/
│   │       ├── create-zone.dto.ts
│   │       └── update-zone.dto.ts
│   ├── dashboard/
│   │   ├── dashboard.module.ts
│   │   ├── dashboard.controller.ts     # GET /dashboard/stats
│   │   └── dashboard.service.ts
│   ├── notifications/
│   │   ├── notifications.module.ts
│   │   ├── email/
│   │   │   ├── email.service.ts        # Nodemailer + Gmail SMTP
│   │   │   └── templates/             # Handlebars HTML templates
│   │   └── whatsapp/
│   │       └── whatsapp.service.ts     # WhatsApp Cloud API
│   └── uploads/
│       └── uploads.module.ts           # Multer config
├── uploads/
│   ├── passports/
│   ├── scooters/
│   ├── signatures/
│   └── agreements/
└── .env
```

---

## Prisma Schema Design

### Models

| Model | Key Fields |
|---|---|
| `User` | id, email, password, role (ADMIN/STAFF), name, active |
| `Scooter` | id, scooter_code, title, brand, model, year, color, plate_number, daily_rate, weekly_rate, monthly_rate, status, description, images (Json) |
| `Booking` | id, booking_id (MS-001-YYYYMMDD), scooter_id, customer_name, nationality, passport_number, passport_image_front, passport_image_back, email, phone, pickup_date, return_date, rental_days, total_amount, security_deposit, status, qr_code, qr_used, agreement_signed, agreement_pdf, signature_image, signed_at, pickup_type, delivery_fee, delivery_zone_id |
| `Payment` | id, payment_id, booking_id, paypal_order_id, amount, currency, payment_status, paid_at |
| `Expense` | id, category, amount, expense_date, note, created_by (User relation) |
| `BookingExtension` | id, booking_id, requested_until, reason, status (PENDING/APPROVED/REJECTED), reviewed_by, reviewed_at |
| `DeliveryZone` | id, zone_name, distance_km, fee |
| `CustomerAccessToken` | id, booking_id, token, expires_at |

---

## Module-by-Module Plan

### AUTH Module

**Endpoints:**
- `POST /auth/login` — email/password → JWT (Admin/Staff)
- `POST /auth/customer-access` — booking_id + passport_number → short-lived token

**Implementation:**
- `LocalStrategy` for username/password
- `JwtStrategy` for Bearer token validation
- `RolesGuard` + `@Roles()` decorator for RBAC
- `@Public()` decorator to bypass JWT on public routes
- Customer token: separate short-lived JWT (24h) with `sub: bookingId, type: 'customer'`

---

### SCOOTERS Module

**Endpoints (Admin/Staff):**
- `GET /scooters` — list with filters (status, search)
- `POST /scooters` — create with image upload (multipart/form-data)
- `GET /scooters/:id` — get one
- `PATCH /scooters/:id` — update
- `DELETE /scooters/:id` — soft delete
- `PATCH /scooters/:id/status` — change status

**Images:** Stored under `uploads/scooters/`, returned as URL array.

---

### BOOKINGS Module

**Endpoints:**
- `POST /bookings` — create booking (triggers QR generation + email)
- `GET /bookings` — list (Admin/Staff) with pagination + filters
- `GET /bookings/:id` — get one (Admin/Staff)
- `GET /bookings/customer/:bookingId` — public (requires customer token)
- `PATCH /bookings/:id` — update booking
- `PATCH /bookings/:id/status` — change status
- `POST /bookings/verify-qr` — verify QR code (marks qr_used=true, status=Picked Up)
- `GET /bookings/:id/agreement` — serve PDF
- `POST /bookings/:id/sign` — upload signature + mark signed

**Booking ID Format:** `MS-{sequence:3digits}-{YYYYMMDD}` — sequence is daily-reset counter (clarification pending, defaulting to global incrementing).

**QR Code:** Generated using `qrcode` npm package. QR encodes `{ bookingId, token: uuid }`. Stored as base64 PNG in DB.

---

### PAYMENTS Module

**Endpoints:**
- `POST /payments/create-order` — create PayPal order for booking
- `POST /payments/capture/:orderId` — capture payment
- `POST /payments/webhook` — PayPal webhook handler

**PayPal Flow:**
1. Client calls `POST /payments/create-order` with `bookingId`
2. Backend creates PayPal order via REST API
3. Client redirects user to PayPal approval URL
4. User approves → `POST /payments/capture/:orderId`
5. On capture success: update booking status → Confirmed, send confirmation email + WhatsApp

**Mode Toggle:** `PAYPAL_MODE=sandbox|live` env var controls which credentials to use.

---

### EXPENSES Module

**Endpoints (Admin/Staff):**
- `POST /expenses` — create expense
- `GET /expenses` — list with date range filter
- `GET /expenses/:id` — get one
- `PATCH /expenses/:id` — update
- `DELETE /expenses/:id` — delete

---

### DASHBOARD Module

**Endpoint:** `GET /dashboard/stats`

**Returns:**
```json
{
  "totalScooters": 20,
  "availableScooters": 15,
  "activeRentals": 3,
  "monthlyRevenue": 45000,
  "monthlyExpenses": 12000,
  "upcomingReturns": [...bookings returning in next 3 days]
}
```

---

### NOTIFICATIONS Module

**Email (Gmail SMTP via Nodemailer):**
- `bookingConfirmation(booking)`
- `paymentSuccess(booking, payment)`
- `returnReminder(booking)`
- `extensionApproved(booking, extension)`
- `extensionRejected(booking, extension)`

HTML templates with Handlebars (`hbs`).

**WhatsApp (Cloud API via axios):**
- Same 5 notification types as email
- Uses WhatsApp message templates (pre-approved)
- Env: `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_API_VERSION`

---

### BOOKING EXTENSION Module

**Endpoints:**
- `POST /bookings/:id/extensions` — customer requests (via customer token)
- `GET /bookings/:id/extensions` — list extensions (Admin)
- `PATCH /extensions/:id/approve` — Admin approves
- `PATCH /extensions/:id/reject` — Admin rejects
- On approval: update booking return_date, send email + WhatsApp
- On rejection: send rejection email + WhatsApp

---

### DELIVERY Module

**Endpoints (Admin):**
- `GET /delivery/zones` — list zones
- `POST /delivery/zones` — create zone
- `PATCH /delivery/zones/:id` — update zone
- `DELETE /delivery/zones/:id` — delete zone

Booking supports `pickup_type: OFFICE | HOTEL` and `delivery_zone_id`.

---

### QR SYSTEM

- On booking creation → generate QR code (package: `qrcode`)
- QR payload: `{ bookingId, verificationToken: uuid }`
- `verificationToken` stored in DB
- `POST /bookings/verify-qr` accepts `{ token }`, finds booking, validates token, marks `qr_used=true`, sets status to `Picked Up`
- One-time use: if `qr_used=true` → reject with 409 Conflict

---

### AGREEMENT SYSTEM

- Admin uploads master agreement PDF: `POST /agreements/upload` (stores in `uploads/agreements/`)
- Booking endpoint `GET /bookings/:id/agreement` → serves/returns PDF URL
- `POST /bookings/:id/sign` — customer submits base64 signature PNG
  - Stores signature in `uploads/signatures/`
  - Sets `agreement_signed=true`, `signed_at=now()`
  - Optionally merges signature onto PDF (using `pdf-lib`)

---

## Dependencies to Install

```
@prisma/client prisma
@nestjs/config
@nestjs/jwt @nestjs/passport passport passport-jwt passport-local
@types/passport-jwt @types/passport-local
bcrypt @types/bcrypt
class-validator class-transformer
qrcode @types/qrcode
nodemailer @types/nodemailer
hbs
pdf-lib
multer @types/multer
axios
uuid @types/uuid
@nestjs/swagger swagger-ui-express
```

---

## Verification Plan

### Automated
- `npm run build` — TypeScript compilation must pass
- `npx prisma validate` — schema must be valid

### Manual
1. Start dev server `npm run dev`
2. Swagger at `http://localhost:3000/api`
3. Test auth flow: login → get JWT → use in Bearer header
4. Create a scooter, create a booking, verify QR, capture payment

---

## Execution Phases

| Phase | Work |
|---|---|
| 1 | Install dependencies, Prisma schema, .env template |
| 2 | Common layer (guards, filters, decorators, interceptors) |
| 3 | Auth module (login, customer access, JWT strategy) |
| 4 | Users module |
| 5 | Scooters module (CRUD + image upload) |
| 6 | Bookings module (CRUD + QR + Agreement) |
| 7 | Payments module (PayPal integration) |
| 8 | Expenses module |
| 9 | Booking Extensions module |
| 10 | Delivery zones module |
| 11 | Notifications (Email + WhatsApp) |
| 12 | Dashboard module |
| 13 | main.ts bootstrap (Swagger, global pipes/filters) |
| 14 | Prisma seed script |
| 15 | Build validation |

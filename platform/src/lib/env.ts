export type Env = {
  DB: D1Database
  BUCKET: R2Bucket
  ASSETS: Fetcher
  SITE_URL: string
  TZ_OFFSET_MIN: string
  BUSINESS_PHONE: string
  WHATSAPP: string
  FACEBOOK_URL: string
  INSTAGRAM_URL: string
  GOOGLE_REVIEW_SCOOTER: string
  GOOGLE_REVIEW_SAFARI: string
  GOOGLE_REVIEW_TAXI: string
  MAIL_FROM_NAME: string
  FEATURE_TAXI?: string
  FEATURE_PERMIT_SERVICE?: string
  SESSION_SECRET: string
  GMAIL_USER?: string
  GMAIL_APP_PASSWORD?: string
  ADMIN_NOTIFY_EMAIL?: string
}

export type User = { id: number; email: string; name: string; role: 'admin' | 'staff' }

export type AppEnv = { Bindings: Env; Variables: { user: User | null } }

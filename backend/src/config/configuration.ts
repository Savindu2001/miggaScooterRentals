export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',

  // ─── Business Identity ──────────────────────────────────────────────────────
  business: {
    name: process.env.BUSINESS_NAME ?? 'Migga Scooter Rentals',
    systemName: process.env.SYSTEM_NAME ?? 'Migga',
    phone: process.env.BUSINESS_PHONE ?? '',
    email: process.env.BUSINESS_EMAIL ?? '',
    supportEmail: process.env.BUSINESS_SUPPORT_EMAIL ?? 'support@migga.lk',
    website: process.env.BUSINESS_WEBSITE ?? 'https://migga.lk',
  },

  // ─── Notification Channel Toggles ──────────────────────────────────────────
  notifications: {
    emailEnabled: process.env.NOTIFICATION_EMAIL_ENABLED === 'true',
    whatsappEnabled: process.env.NOTIFICATION_WHATSAPP_ENABLED === 'true',
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'change_me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    customerExpiresIn: process.env.JWT_CUSTOMER_EXPIRES_IN ?? '24h',
  },

  paypal: {
    mode: process.env.PAYPAL_MODE ?? 'sandbox', // 'sandbox' | 'live'
    clientId:
      process.env.PAYPAL_MODE === 'live'
        ? (process.env.PAYPAL_CLIENT_ID_LIVE ?? '')
        : (process.env.PAYPAL_CLIENT_ID_SANDBOX ?? ''),
    secret:
      process.env.PAYPAL_MODE === 'live'
        ? (process.env.PAYPAL_SECRET_LIVE ?? '')
        : (process.env.PAYPAL_SECRET_SANDBOX ?? ''),
    clientIdSandbox: process.env.PAYPAL_CLIENT_ID_SANDBOX ?? '',
    secretSandbox: process.env.PAYPAL_SECRET_SANDBOX ?? '',
    clientIdLive: process.env.PAYPAL_CLIENT_ID_LIVE ?? '',
    secretLive: process.env.PAYPAL_SECRET_LIVE ?? '',
  },

  gmail: {
    user: process.env.GMAIL_USER ?? '',
    password: process.env.GMAIL_APP_PASSWORD ?? '',
    fromName: process.env.EMAIL_FROM_NAME ?? 'Migga Rentals',
  },

  whatsapp: {
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID ?? '',
    accessToken: process.env.WA_ACCESS_TOKEN ?? '',
    apiVersion: process.env.WA_API_VERSION ?? 'v19.0',
  },
});

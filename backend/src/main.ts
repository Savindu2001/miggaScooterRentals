import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'verbose'],
  });

  // ─── CORS ─────────────────────────────────────────────────────────────────
  const allowedOrigins = [
    process.env.FRONTEND_URL ?? 'http://localhost:3001',
    'http://localhost:5173', // Customer web (Vite)
    'http://localhost:5174', // Customer web (Vite — alternate port)
    'http://localhost:3001', // Admin (Next.js)
  ];
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, true); // Permissive for development; restrict in production
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ─── Global Prefix ────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── Global Validation Pipe ───────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Global Guards ────────────────────────────────────────────────────────
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector), new RolesGuard(reflector));

  // ─── Global Interceptors ──────────────────────────────────────────────────
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
    new ClassSerializerInterceptor(reflector),
  );

  // ─── Global Exception Filter ──────────────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ─── Raw Body for PayPal Webhooks ────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ─── Swagger ──────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Migga Scooter Rentals API')
    .setDescription(
      `
## Migga Production Backend API

Complete REST API for the Migga scooter rental platform.

### Authentication
- Staff (Admin/Staff): Login via \`POST /auth/login\` to receive a Bearer JWT token
- Customers: Use \`POST /auth/customer-access\` with bookingId + passport number

### Roles
- **ADMIN**: Full access to all endpoints
- **STAFF**: Access to booking, scooter, and expense management
- **Customer**: Read-only access to own booking via customer token
      `,
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication — staff login and customer access')
    .addTag('Users', 'Staff user management (Admin only)')
    .addTag('Scooters', 'Scooter fleet management')
    .addTag('Bookings', 'Rental bookings lifecycle')
    .addTag('Payments', 'PayPal payment integration')
    .addTag('Expenses', 'Expense tracking')
    .addTag('Booking Extensions', 'Rental extension requests')
    .addTag('Delivery Zones', 'Hotel delivery zone management')
    .addTag('Dashboard', 'Business intelligence and stats')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Migga API Docs',
    customCss: `
      .swagger-ui .topbar { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); }
      .swagger-ui .topbar-wrapper a span { display: none; }
      .swagger-ui .topbar-wrapper a::before { content: '🛵 MIGGA API'; color: #e94560; font-weight: 800; font-size: 18px; }
    `,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`\n🛵 Migga Backend is running on: http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger Docs: http://localhost:${port}/api/docs\n`);
}

bootstrap();

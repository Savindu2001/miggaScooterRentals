import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ─── Default Admin User ──────────────────────────────────────────────────
  const adminEmail = 'savindu.info@gmail.com';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existing) {
    const hashedPassword = await bcrypt.hash('Admin@1234!', 12);
    const admin = await prisma.user.create({
      data: {
        name: 'Migga Admin',
        email: adminEmail,
        password: hashedPassword,
        role: Role.ADMIN,
        isActive: true,
      },
    });
    console.log(`✅ Admin user created: ${admin.email}`);
  } else {
    console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
  }

  // ─── Default Staff User ──────────────────────────────────────────────────
  const staffEmail = 'staff@migga.com';
  const existingStaff = await prisma.user.findUnique({ where: { email: staffEmail } });

  if (!existingStaff) {
    const hashedPassword = await bcrypt.hash('Staff@1234!', 12);
    await prisma.user.create({
      data: {
        name: 'Migga Staff',
        email: staffEmail,
        password: hashedPassword,
        role: Role.STAFF,
        isActive: true,
      },
    });
    console.log(`✅ Staff user created: ${staffEmail}`);
  }

  // ─── Booking Counter ─────────────────────────────────────────────────────
  await prisma.bookingCounter.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, count: 0 },
  });
  console.log('✅ Booking counter initialized');

  // ─── Sample Delivery Zones ───────────────────────────────────────────────
  const zones = [
    { zoneName: 'Zone 1 - Town Centre', distanceKm: 1, fee: 700 },
    { zoneName: 'Zone 2 - Nearby Hotels', distanceKm: 3, fee: 1200 },
    { zoneName: 'Zone 3 - Airport Area', distanceKm: 5, fee: 2000 },
    { zoneName: 'Zone 4 - Remote Resorts', distanceKm: 10, fee: 3500 },
  ];

  for (const zone of zones) {
    const existing = await prisma.deliveryZone.findFirst({
      where: { zoneName: zone.zoneName },
    });
    if (!existing) {
      await prisma.deliveryZone.create({ data: zone });
      console.log(`✅ Delivery zone created: ${zone.zoneName}`);
    }
  }

  // ─── Sample Scooters ─────────────────────────────────────────────────────
  const scooters = [
    {
      scooterCode: 'SC-001',
      title: 'Honda PCX 160 Premium',
      brand: 'Honda',
      model: 'PCX 160',
      year: 2024,
      color: 'Matte Black',
      plateNumber: 'MV-1001',
      dailyRate: 35,
      weeklyRate: 200,
      monthlyRate: 700,
      description: 'Premium scooter with CBS braking and smart key system.',
    },
    {
      scooterCode: 'SC-002',
      title: 'Yamaha NMAX 155 ABS',
      brand: 'Yamaha',
      model: 'NMAX 155',
      year: 2024,
      color: 'Pearl White',
      plateNumber: 'MV-1002',
      dailyRate: 38,
      weeklyRate: 220,
      monthlyRate: 750,
      description: 'Sporty commuter with ABS and traction control.',
    },
    {
      scooterCode: 'SC-003',
      title: 'Honda Beat 110',
      brand: 'Honda',
      model: 'Beat 110',
      year: 2023,
      color: 'Red',
      plateNumber: 'MV-1003',
      dailyRate: 25,
      weeklyRate: 150,
      monthlyRate: 500,
      description: 'Lightweight and economical city scooter.',
    },
  ];

  for (const scooter of scooters) {
    const existing = await prisma.scooter.findFirst({
      where: { scooterCode: scooter.scooterCode },
    });
    if (!existing) {
      await prisma.scooter.create({ data: scooter });
      console.log(`✅ Scooter created: ${scooter.scooterCode} — ${scooter.title}`);
    }
  }

  console.log('\n🎉 Seed completed successfully!\n');
  console.log('─────────────────────────────────────────');
  console.log('Default Credentials:');
  console.log(`  Admin → admin@migga.com / Admin@1234!`);
  console.log(`  Staff → staff@migga.com / Staff@1234!`);
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

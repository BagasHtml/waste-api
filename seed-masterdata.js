// seed-master-data.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding FleetInventory & TpaFacility...');

  await prisma.fleetInventory.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      truck_type: "5-Ton Compactor Truck",
      total_units: 45,
      ready_units: 38,
      capacity_per_truck_ton: 5.0
    }
  });

  await prisma.tpaFacility.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "TPST Bantargebang",
      max_capacity_ton: 7500.0,
      current_load_ton: 0.0
    }
  });

  console.log('✅ Fleet & TPA seeded successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
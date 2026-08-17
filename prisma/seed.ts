import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

import { GlobalRole, ManpowerRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";

async function main() {
  const email = (
    process.env.SUPER_ADMIN_EMAIL ?? "ashishu703@gmail.com"
  )
    .toLowerCase()
    .trim();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("SUPER_ADMIN_PASSWORD must be set to seed Super Admin");
  }

  const PLANTS = [
    { code: "CAT6", name: "CAT-6 Cable Plant" },
    { code: "PVC", name: "PVC Plant" },
    { code: "LTDROPE", name: "LTD Rope Light Plant" },
  ];

  const plants = [];
  for (const entry of PLANTS) {
    plants.push(
      await prisma.plant.upsert({
        where: { code: entry.code },
        update: { name: entry.name, isActive: true },
        create: { name: entry.name, code: entry.code, isActive: true },
      }),
    );
  }

  const plant = plants[0]!;

  const rateRows: { role: ManpowerRole; ratePerDay: number }[] = [
    { role: ManpowerRole.MANAGER, ratePerDay: 4000 },
    { role: ManpowerRole.OPERATOR, ratePerDay: 1500 },
    { role: ManpowerRole.HELPER, ratePerDay: 800 },
  ];

  for (const target of plants) {
    for (const row of rateRows) {
      await prisma.manpowerRateSetting.upsert({
        where: {
          plantId_role: {
            plantId: target.id,
            role: row.role,
          },
        },
        update: {
          ratePerDay: row.ratePerDay,
        },
        create: {
          plantId: target.id,
          role: row.role,
          ratePerDay: row.ratePerDay,
        },
      });
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Super Admin",
      passwordHash,
      globalRole: GlobalRole.SUPER_ADMIN,
      canViewPriceSheet: true,
      isActive: true,
      creditScore: 100,
    },
    create: {
      email,
      name: "Super Admin",
      passwordHash,
      globalRole: GlobalRole.SUPER_ADMIN,
      canViewPriceSheet: true,
      isActive: true,
      creditScore: 100,
    },
  });

  await prisma.userPlantRole.upsert({
    where: {
      userId_plantId: {
        userId: admin.id,
        plantId: plant.id,
      },
    },
    update: {
      role: GlobalRole.SUPER_ADMIN,
    },
    create: {
      userId: admin.id,
      plantId: plant.id,
      role: GlobalRole.SUPER_ADMIN,
    },
  });

  const managerEmail = (
    process.env.PLANT_MANAGER_EMAIL ?? "manager@cat6.local"
  )
    .toLowerCase()
    .trim();
  const managerPassword = process.env.PLANT_MANAGER_PASSWORD ?? password;
  const managerHash = await bcrypt.hash(managerPassword, 12);

  const manager = await prisma.user.upsert({
    where: { email: managerEmail },
    update: {
      name: "Plant Manager",
      passwordHash: managerHash,
      globalRole: GlobalRole.PLANT_MANAGER,
      canViewPriceSheet: false,
      isActive: true,
    },
    create: {
      email: managerEmail,
      name: "Plant Manager",
      passwordHash: managerHash,
      globalRole: GlobalRole.PLANT_MANAGER,
      canViewPriceSheet: false,
      isActive: true,
    },
  });

  await prisma.userPlantRole.upsert({
    where: {
      userId_plantId: {
        userId: manager.id,
        plantId: plant.id,
      },
    },
    update: {
      role: GlobalRole.PLANT_MANAGER,
    },
    create: {
      userId: manager.id,
      plantId: plant.id,
      role: GlobalRole.PLANT_MANAGER,
    },
  });

  console.log("Seed complete:");
  for (const target of plants) {
    console.log(`  Plant: ${target.name} (${target.code}) id=${target.id}`);
  }
  console.log(`  Super Admin: ${admin.email} id=${admin.id}`);
  console.log(`  Plant Manager: ${manager.email} id=${manager.id}`);
  console.log("  Manpower rates: Manager 4000 / Operator 1500 / Helper 800");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

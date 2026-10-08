// Dev seed with FICTIONAL people only (GDPR: never seed real staff). Builds
// the product owner's inventory through the real staffing store, so every row
// passes the same rules and constraints as the app. Safe to re-run: it does
// nothing when employees already exist. Refresh the dev DB with
// `npx prisma migrate reset --force` then `npx prisma db seed`.
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { createEmployee, createPosition } from '../src/server/staffing-store';
import { SEED_INVENTORY, SEED_START } from './seed-data';

config({ path: ['.env.local', '.env'], quiet: true });

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run the dev seed in production.');
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const asSeed = () => ({ operationId: randomUUID(), actor: 'seed' });

async function main() {
  if ((await db.employee.count()) > 0) {
    console.log('Seed skipped: employees already exist.');
    return;
  }

  const houses = await db.house.findMany();
  let people = 0;
  for (const { houseSlug, positions } of SEED_INVENTORY) {
    const house = houses.find((h) => h.slug === houseSlug);
    if (!house) throw new Error(`House ${houseSlug} is missing: run the migrations first.`);
    for (const { label, roleCode, occupant } of positions) {
      const { result } = await createPosition(db, asSeed(), house.id, { roleCode, label });
      await createEmployee(db, asSeed(), house.id, { fullName: occupant, startsOn: SEED_START, endsOn: null, positionId: result.positionId });
      people += 1;
    }
  }

  console.log(`Seeded ${people} fictional employees, each in their own position from ${SEED_START}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

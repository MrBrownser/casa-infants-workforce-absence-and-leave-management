// Dev seed with FICTIONAL people only (GDPR: never seed real staff). Runs the
// Task 12 rewrites it to go through the staffing store.
// Safe to re-run: it does nothing when employees already exist.
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { isoDateToDate } from '../src/lib/dates';

config({ path: ['.env.local', '.env'], quiet: true });

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run the dev seed in production.');
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const SEED_START = '2025-09-01';

// Roles (CT, ER) arrive with SPEC-002; for now they are only noted here.
const PEOPLE = [
  { fullName: 'Ana Puig', house: 'paulo-freire' },
  { fullName: 'Jordi Vidal', house: 'paulo-freire' }, // corretor (CT)
  { fullName: 'Laia Serra', house: 'paulo-freire' }, // ER
  { fullName: 'Marta Soler', house: 'carme-aymerich' },
  { fullName: 'Pau Ferrer', house: 'carme-aymerich' }, // corretor (CT)
  { fullName: 'Núria Costa', house: 'carme-aymerich' },
] as const;

async function main() {
  if ((await db.employee.count()) > 0) {
    console.log('Seed skipped: employees already exist.');
    return;
  }

  const houses = await db.house.findMany();
  const houseId = (slug: string) => {
    const house = houses.find((h) => h.slug === slug);
    if (!house) throw new Error(`House ${slug} is missing: run the migrations first.`);
    return house.id;
  };

  for (const person of PEOPLE) {
    await db.employee.create({
      data: {
        fullName: person.fullName,
        memberships: { create: { houseId: houseId(person.house), startsOn: isoDateToDate(SEED_START) } },
      },
    });
  }

  console.log(`Seeded ${PEOPLE.length} fictional employees.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

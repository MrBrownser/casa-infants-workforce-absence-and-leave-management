// Dev seed with FICTIONAL people only (GDPR: never seed real staff). Runs the
// real transfer path so Ana's House history is built exactly as the app would.
// Safe to re-run: it does nothing when employees already exist.
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { isoDateToDate } from '../src/lib/dates';
import { applyTransfer } from '../src/server/membership-store';

config({ path: ['.env.local', '.env'], quiet: true });

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run the dev seed in production.');
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const SEED_START = '2025-09-01';
const ANA_MOVES_ON = '2026-07-01';

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

  const ana = await db.employee.findFirstOrThrow({ where: { fullName: 'Ana Puig' } });
  await applyTransfer(db, ana.id, houseId('carme-aymerich'), ANA_MOVES_ON);

  console.log(`Seeded ${PEOPLE.length} fictional employees. Ana Puig moves to Carme Aymerich on ${ANA_MOVES_ON}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

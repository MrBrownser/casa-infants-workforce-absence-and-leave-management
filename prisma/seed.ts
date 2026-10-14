// Dev seed with FICTIONAL people only (GDPR: never seed real staff). The names
// come from the list the product owner validated for SPEC-002; PDG and PSI are
// shared by both Houses. Writes through the people store, so every row passes
// the app's seat rules. Safe to re-run: it does nothing when people exist.
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import type { IsoDate } from '../src/lib/dates';
import type { HouseSlug } from '../src/lib/houses';
import type { OpeningBalances } from '../src/lib/rules';
import { addPerson, deactivatePerson, saveOpeningBalances } from '../src/server/people-store';

config({ path: ['.env.local', '.env'], quiet: true });

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run the dev seed in production.');
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const SEED_START: IsoDate = '2025-09-01';

type SeedPerson = {
  fullName: string;
  house: HouseSlug | null;
  postKey: string;
  seat?: number;
  startedOn?: IsoDate;
  active?: boolean;
  balances2026?: OpeningBalances;
};

const PEOPLE: readonly SeedPerson[] = [
  // Shared by both Houses.
  { fullName: 'Meritxell Torres Vila', house: null, postKey: 'pdg' },
  { fullName: 'Sílvia Miró Esteve', house: null, postKey: 'psi' },
  { fullName: 'Clara Soler Pujol', house: null, postKey: 'pdg', active: false },
  // Paulo Freire.
  { fullName: 'Carla Ribas Solé', house: 'paulo-freire', postKey: 'er' },
  { fullName: 'Montse Molina Prat', house: 'paulo-freire', postKey: 'tfm' },
  { fullName: 'Noèlia Fernández Grau', house: 'paulo-freire', postKey: 'tft' },
  { fullName: 'Roger Beltrán Camps', house: 'paulo-freire', postKey: 'et', balances2026: { vacationDays: 31, carriedDays: 2, surplusMinutes: -240 } },
  { fullName: 'Mireia Santos Rovira', house: 'paulo-freire', postKey: 'ecs', balances2026: { vacationDays: 31, carriedDays: 3, surplusMinutes: 720 } },
  { fullName: 'David Valls Medina', house: 'paulo-freire', postKey: 'en', seat: 1, balances2026: { vacationDays: 31, carriedDays: 0, surplusMinutes: -555 } },
  { fullName: 'Cristina Pascual Duran', house: 'paulo-freire', postKey: 'en', seat: 2 },
  { fullName: 'Pol Jiménez Alcover', house: 'paulo-freire', postKey: 'ct' },
  { fullName: 'Núria Roca Ferrer', house: 'paulo-freire', postKey: 'tfm', active: false },
  // Carme Aymerich: the CT is vacant.
  { fullName: 'Laia Vidal Mas', house: 'carme-aymerich', postKey: 'er' },
  { fullName: 'Rosa Navarro Costa', house: 'carme-aymerich', postKey: 'tfm' },
  { fullName: 'Aina Martín Serra', house: 'carme-aymerich', postKey: 'tft', startedOn: '2026-07-01' },
  { fullName: 'Júlia Romero Bosch', house: 'carme-aymerich', postKey: 'et' },
  { fullName: 'Berta Puig Casas', house: 'carme-aymerich', postKey: 'ecs' },
  { fullName: 'Marc Sánchez Riera', house: 'carme-aymerich', postKey: 'en', seat: 1 },
  { fullName: 'Irene López Font', house: 'carme-aymerich', postKey: 'en', seat: 2 },
  { fullName: 'Àlex García Martí', house: 'carme-aymerich', postKey: 'ct', active: false },
];

async function main() {
  if ((await db.person.count()) > 0) {
    console.log('Seed skipped: people already exist.');
    return;
  }

  // Inactive people first: they leave the seat free for whoever covers it now.
  const ordered = [...PEOPLE].sort((a, b) => Number(a.active ?? true) - Number(b.active ?? true));
  for (const person of ordered) {
    const id = await addPerson(db, {
      fullName: person.fullName,
      startedOn: person.startedOn ?? SEED_START,
      seat: { house: person.house, postKey: person.postKey, seat: person.seat ?? 1 },
    });
    if (person.active === false) await deactivatePerson(db, id);
    if (person.balances2026) await saveOpeningBalances(db, id, 2026, person.balances2026);
  }

  console.log(`Seeded ${PEOPLE.length} fictional people (${PEOPLE.filter((p) => p.active === false).length} inactive).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

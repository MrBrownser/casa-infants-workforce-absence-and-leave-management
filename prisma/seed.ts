// Dev seed with FICTIONAL people only (GDPR: never seed real staff). The names
// come from the list the product owner validated for SPEC-002; PDG and PSI are
// shared by both Houses. Writes through the people store, so every row passes
// the app's seat rules. Safe to re-run: people and APs are each added only when none exist.
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import type { IsoDate } from '../src/lib/dates';
import type { ApKind } from '../src/lib/balances';
import type { HouseSlug } from '../src/lib/houses';
import type { OpeningBalances } from '../src/lib/rules';
import { createAp } from '../src/server/aps-store';
import { addPerson, deactivatePerson, saveOpeningBalances } from '../src/server/people-store';

config({ path: ['.env.local', '.env'], quiet: true });

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run the dev seed in production.');
}
// Explicit opt-in on the command line, never in .env.local: an empty production
// database pointed at by mistake would otherwise get the fictional people.
if (process.env.ALLOW_DEV_SEED !== '1') {
  throw new Error('The dev seed writes fictional people. Run it with ALLOW_DEV_SEED=1 npx prisma db seed, against the dev database only.');
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

async function seedPeople() {
  if ((await db.person.count()) > 0) {
    console.log('People skipped: people already exist.');
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

type SeedAp = { fullName: string; house: HouseSlug; kind: ApKind; date: IsoDate; minutes: number; year?: number };

// 2026 APs (SPEC-004), fictional. Paulo Freire: two people owe hours (Roger
// Beltrán Camps −4 h from his opening balance, David Valls Medina −9 h 15 min);
// Carla Ribas Solé has used her 5 APs no recuperables; Mireia Santos Rovira has a
// January 2027 AP counted toward 2026; Núria Roca Ferrer (inactive) shows under
// "Antics membres". Carme Aymerich: Júlia Romero Bosch owes hours after an AP
// recuperable; the shared Pedagoga has an AP recorded there.
const APS: readonly SeedAp[] = [
  ...['2026-02-20', '2026-05-15', '2026-06-12', '2026-09-25', '2026-10-09'].map(
    (date): SeedAp => ({ fullName: 'Carla Ribas Solé', house: 'paulo-freire', kind: 'non_recoverable', date, minutes: 240 }),
  ),
  { fullName: 'David Valls Medina', house: 'paulo-freire', kind: 'non_recoverable', date: '2026-03-18', minutes: 660 },
  { fullName: 'David Valls Medina', house: 'paulo-freire', kind: 'non_recoverable', date: '2026-03-19', minutes: 660 },
  { fullName: 'Mireia Santos Rovira', house: 'paulo-freire', kind: 'recoverable', date: '2026-06-19', minutes: 585 },
  { fullName: 'Mireia Santos Rovira', house: 'paulo-freire', kind: 'non_recoverable', date: '2027-01-15', minutes: 120, year: 2026 },
  { fullName: 'Núria Roca Ferrer', house: 'paulo-freire', kind: 'non_recoverable', date: '2026-02-06', minutes: 480 },
  ...['2026-03-02', '2026-06-12', '2026-10-15'].map(
    (date): SeedAp => ({ fullName: 'Laia Vidal Mas', house: 'carme-aymerich', kind: 'non_recoverable', date, minutes: 240 }),
  ),
  { fullName: 'Júlia Romero Bosch', house: 'carme-aymerich', kind: 'recoverable', date: '2026-09-29', minutes: 390 },
  { fullName: 'Meritxell Torres Vila', house: 'carme-aymerich', kind: 'non_recoverable', date: '2026-01-05', minutes: 90 },
];

async function seedAps() {
  if ((await db.ap.count()) > 0) {
    console.log('APs skipped: APs already exist.');
    return;
  }
  for (const ap of APS) {
    const person = await db.person.findFirst({ where: { fullName: ap.fullName }, select: { id: true } });
    if (!person) throw new Error(`Seed person ${ap.fullName} is missing.`);
    await createAp(db, { personId: person.id, house: ap.house, kind: ap.kind, year: ap.year ?? 2026, date: ap.date, minutes: ap.minutes });
  }
  console.log(`Seeded ${APS.length} fictional APs.`);
}

async function main() {
  await seedPeople();
  await seedAps();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

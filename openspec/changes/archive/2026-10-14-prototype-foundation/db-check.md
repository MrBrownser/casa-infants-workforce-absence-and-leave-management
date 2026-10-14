# Database and browser checks (prototype-foundation)

Date: 2026-10-13. Local throwaway Postgres 16.15 (cloud session), migration `20261013102029_init`
applied with `prisma migrate deploy` on an empty database. `prisma migrate dev --create-only`
afterwards produced an empty migration: Prisma keeps the hand-written partial indexes and CHECKs.

## Seed (run twice)

```
Seeded 20 fictional people (3 inactive).
Seed skipped: people already exist.
```

```
     house      | post_key | seat |       full_name        | active 
----------------+----------+------+------------------------+--------
 carme-aymerich | ct       |    1 | Àlex García Martí      | f
 carme-aymerich | ecs      |    1 | Berta Puig Casas       | t
 carme-aymerich | en       |    1 | Marc Sánchez Riera     | t
 carme-aymerich | en       |    2 | Irene López Font       | t
 carme-aymerich | er       |    1 | Laia Vidal Mas         | t
 carme-aymerich | et       |    1 | Júlia Romero Bosch     | t
 carme-aymerich | tfm      |    1 | Rosa Navarro Costa     | t
 carme-aymerich | tft      |    1 | Aina Martín Serra      | t
 paulo-freire   | ct       |    1 | Pol Jiménez Alcover    | t
 paulo-freire   | ecs      |    1 | Mireia Santos Rovira   | t
 paulo-freire   | en       |    1 | David Valls Medina     | t
 paulo-freire   | en       |    2 | Cristina Pascual Duran | t
 paulo-freire   | er       |    1 | Carla Ribas Solé       | t
 paulo-freire   | et       |    1 | Roger Beltrán Camps    | t
 paulo-freire   | tfm      |    1 | Montse Molina Prat     | t
 paulo-freire   | tfm      |    1 | Núria Roca Ferrer      | f
 paulo-freire   | tft      |    1 | Noèlia Fernández Grau  | t
 shared         | pdg      |    1 | Meritxell Torres Vila  | t
 shared         | pdg      |    1 | Clara Soler Pujol      | f
 shared         | psi      |    1 | Sílvia Miró Esteve     | t
(20 rows)
```

## Seat indexes and CHECKs (by hand, plan Task 5 Step 4)

1. Second active person on Paulo Freire ER seat 1: rejected by `people_active_house_seat_key`.
2. Second active person on the shared PDG seat: rejected by `people_active_shared_seat_key`.
3. An inactive person on the occupied PDG seat: accepted (then deleted).
4. Seat 3: rejected by `people_seat_check`. Blank name: rejected by `people_full_name_check`.
5. `vacation_days = -1`: rejected by `person_years_vacation_days_check`.

```
ERROR:  duplicate key value violates unique constraint "people_active_house_seat_key"
ERROR:  duplicate key value violates unique constraint "people_active_shared_seat_key"
INSERT 0 1
DELETE 1
ERROR:  new row for relation "people" violates check constraint "people_seat_check"
ERROR:  new row for relation "people" violates check constraint "people_full_name_check"
ERROR:  new row for relation "person_years" violates check constraint "person_years_vacation_days_check"
```

Prisma 7 with `@prisma/adapter-pg` raises `PrismaClientKnownRequestError` code `P2002` when a
write hits one of the partial unique indexes; the store maps it to `SeatTakenError`. Checked
against the seeded local database with the generated client: a second active person on the shared
PDG seat via `db.person.create` printed `instanceof PrismaClientKnownRequestError: true, code: P2002`.

## Supabase dev (eu-west-1), product owner's local session

2026-10-13: the product owner confirmed the reset. `npx prisma migrate reset --force` applied
`20261013102029_init` (the SPEC-001 and unmerged SPEC-002 tables and their fictional data were
dropped), then `npx prisma db seed` printed "Seeded 20 fictional people (3 inactive).". The same
checks, each inside a rolled-back transaction, plus one write through the generated client:

```
second active on Paulo Freire ER seat 1: rejected by people_active_house_seat_key
second active on shared PDG seat: rejected by people_active_shared_seat_key
inactive on occupied PDG seat: accepted (1 row)
seat 3: rejected by people_seat_check
blank name: rejected by people_full_name_check
vacation_days -1: rejected by person_years_vacation_days_check
people after checks: active 17 inactive 3
Prisma: instanceof PrismaClientKnownRequestError true, code P2002
```

`npm run build` with the real `.env.local`: passes (routes `/[house]`, `/[house]/team`,
`/dashboard`, `/no-access`).

## Browser check (plan Task 14), product owner's local session

2026-10-13, `npm run dev` against the reset Supabase dev database, signed in with a director
account, gstack `browse` (headed Chromium).

- Desktop 1280px: `/paulo-freire` redirects to `/paulo-freire/team`; Saldos, Vacances and El mes
  are non-link spans tagged "aviat", Equip is the current link; `/paulo-freire/saldos` shows the
  Catalan 404. Shared posts first with "Aquesta setmana: dl–dc a Carme Aymerich, dj–dv a Paulo
  Freire."; seven posts with their schedules; the night post shows both people with "Aquesta
  setmana" / "La setmana vinent"; Antics membres lists Clara Soler Pujol and Núria Roca Ferrer.
- Add: blank name and `31/02/2026` show errors with icon and text; "Ona Ferrer Pons" added to the
  vacant Corretorn of Carme Aymerich.
- Rename: Roger Beltrán Camps renamed and restored; title and card update.
- Antics membres: Pol Jiménez Alcover after the confirmation step; the Corretorn shows "Vacant";
  reactivated into it afterwards.
- Move: Roger to the vacant Corretorn and back ("Fet.", select cleared); Ona from Carme Aymerich to
  Paulo Freire and back (the other House's seat becomes "Vacant"). Only vacant seats are offered,
  so the occupied-seat message is covered by the unit tests, not by this check.
- Balances: Mireia Santos Rovira 2026 shows 31 dies / 3 / +12 h; `9:75` shows the error with an
  icon; "−" and `9:15` saves and shows "−9 h 15 min" (restored to +12:00); 2027 shows defaults and
  "Encara no s'han desat"; Aina Martín Serra (started 01/07/2026) defaults to 16 days.
- House switch from `/paulo-freire/team` lands on `/carme-aymerich/team`, shared people shown, no
  Paulo Freire names.
- Mobile 390px: bottom tab bar with the three sections dimmed and Equip active; one column of
  cards; the person sheet opens from the bottom; inputs 44px high; no horizontal scroll.
- Found and fixed: two copy lines assumed a woman ("Mou-la", "la pots reincorporar"); now neutral.
- Fixed after the check (from the final review): "Desat." now stays after a save that changes a
  value; the sheet keeps Tab inside, locks the page scroll, focuses the name field when adding a
  person and returns focus to the opener; letters typed in a duration field stay visible and show
  the H:MM error with an icon when leaving the field.


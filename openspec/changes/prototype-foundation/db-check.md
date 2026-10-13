# Database check (prototype-foundation)

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

## Pending (product owner, local session)

- Supabase dev reset: `npx prisma migrate reset --force`, then `npx prisma db seed`.
- Browser check on desktop and mobile (plan Task 14).
- `npm run build` with real Clerk keys. (It already passes with placeholder keys in the cloud
  session: routes `/[house]`, `/[house]/team`, `/dashboard`, `/no-access`.)

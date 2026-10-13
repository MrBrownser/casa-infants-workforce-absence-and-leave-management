-- CreateTable
CREATE TABLE "houses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "houses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" TEXT NOT NULL,
    "house_id" UUID,
    "post_key" TEXT NOT NULL,
    "seat" INTEGER NOT NULL DEFAULT 1,
    "started_on" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_years" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "vacation_days" INTEGER NOT NULL,
    "carried_days" INTEGER NOT NULL,
    "surplus_minutes" INTEGER NOT NULL,

    CONSTRAINT "person_years_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "houses_slug_key" ON "houses"("slug");

-- CreateIndex
CREATE INDEX "people_house_id_idx" ON "people"("house_id");

-- CreateIndex
CREATE UNIQUE INDEX "person_years_person_id_year_key" ON "person_years"("person_id", "year");

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_years" ADD CONSTRAINT "person_years_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: Prisma cannot express these. Do not remove.

-- One active person per seat (design D4): per House for the House posts...
CREATE UNIQUE INDEX "people_active_house_seat_key" ON "people" ("house_id", "post_key", "seat") WHERE "active" AND "house_id" IS NOT NULL;
-- ...and per seat for the shared posts, whose people have no House.
CREATE UNIQUE INDEX "people_active_shared_seat_key" ON "people" ("post_key", "seat") WHERE "active" AND "house_id" IS NULL;

ALTER TABLE "people" ADD CONSTRAINT "people_full_name_check" CHECK (btrim("full_name") <> '');
ALTER TABLE "people" ADD CONSTRAINT "people_seat_check" CHECK ("seat" BETWEEN 1 AND 2);

ALTER TABLE "person_years" ADD CONSTRAINT "person_years_year_check" CHECK ("year" BETWEEN 2000 AND 2100);
ALTER TABLE "person_years" ADD CONSTRAINT "person_years_vacation_days_check" CHECK ("vacation_days" BETWEEN 0 AND 99);
ALTER TABLE "person_years" ADD CONSTRAINT "person_years_carried_days_check" CHECK ("carried_days" BETWEEN 0 AND 99);
ALTER TABLE "person_years" ADD CONSTRAINT "person_years_surplus_minutes_check" CHECK ("surplus_minutes" BETWEEN -60000 AND 60000);

-- The two Houses. Keep in sync with HOUSES in src/lib/houses.ts.
INSERT INTO "houses" ("slug", "name") VALUES
  ('paulo-freire', 'Paulo Freire'),
  ('carme-aymerich', 'Carme Aymerich');

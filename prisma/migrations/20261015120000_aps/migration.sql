-- CreateEnum
CREATE TYPE "ap_kind" AS ENUM ('non_recoverable', 'recoverable');

-- CreateTable
CREATE TABLE "aps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" UUID NOT NULL,
    "house_id" UUID NOT NULL,
    "kind" "ap_kind" NOT NULL,
    "year" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aps_person_id_year_idx" ON "aps"("person_id", "year");

-- AddForeignKey
ALTER TABLE "aps" ADD CONSTRAINT "aps_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aps" ADD CONSTRAINT "aps_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: Prisma cannot express these. Do not remove.
ALTER TABLE "aps" ADD CONSTRAINT "aps_year_check" CHECK ("year" BETWEEN 2000 AND 2100);
-- APs of a year can be taken until 31 January of the next year (FPOL32 §1).
ALTER TABLE "aps" ADD CONSTRAINT "aps_date_check" CHECK ("date" BETWEEN make_date("year", 1, 1) AND make_date("year" + 1, 1, 31));
ALTER TABLE "aps" ADD CONSTRAINT "aps_minutes_check" CHECK ("minutes" BETWEEN 1 AND 1440);

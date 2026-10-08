-- CreateTable
CREATE TABLE "houses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "houses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "house_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "house_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,

    CONSTRAINT "house_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "houses_slug_key" ON "houses"("slug");

-- CreateIndex
CREATE INDEX "house_memberships_house_id_starts_on_idx" ON "house_memberships"("house_id", "starts_on");

-- CreateIndex
CREATE INDEX "house_memberships_employee_id_idx" ON "house_memberships"("employee_id");

-- AddForeignKey
ALTER TABLE "house_memberships" ADD CONSTRAINT "house_memberships_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_memberships" ADD CONSTRAINT "house_memberships_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: Prisma cannot express these. Do not remove.

-- One House at a time (BR-002): no overlapping periods per employee.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "house_memberships"
  ADD CONSTRAINT "house_memberships_period_check"
  CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");

ALTER TABLE "house_memberships"
  ADD CONSTRAINT "house_memberships_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    daterange("starts_on", "ends_on", '[]') WITH &&
  );

-- The two Houses (FR-001). Keep in sync with HOUSES in src/lib/houses.ts.
INSERT INTO "houses" ("slug", "name") VALUES
  ('paulo-freire', 'Paulo Freire'),
  ('carme-aymerich', 'Carme Aymerich');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "occupational_roles" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "occupational_roles_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "house_id" UUID NOT NULL,
    "role_code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "label_key" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "house_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_grants" (
    "clerk_user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "access_grants_pkey" PRIMARY KEY ("clerk_user_id")
);

-- CreateTable
CREATE TABLE "employee_account_links" (
    "employee_id" UUID NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_account_links_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "operation_receipts" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "actor_clerk_user_id" TEXT NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "positions_house_id_label_key_key" ON "positions"("house_id", "label_key");

-- CreateIndex
CREATE UNIQUE INDEX "positions_id_house_id_key" ON "positions"("id", "house_id");

-- CreateIndex
CREATE INDEX "position_assignments_house_id_starts_on_idx" ON "position_assignments"("house_id", "starts_on");

-- CreateIndex
CREATE INDEX "position_assignments_employee_id_idx" ON "position_assignments"("employee_id");

-- CreateIndex
CREATE INDEX "position_assignments_position_id_idx" ON "position_assignments"("position_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_account_links_clerk_user_id_key" ON "employee_account_links"("clerk_user_id");

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "occupational_roles"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_assignments" ADD CONSTRAINT "position_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_assignments" ADD CONSTRAINT "position_assignments_position_id_house_id_fkey" FOREIGN KEY ("position_id", "house_id") REFERENCES "positions"("id", "house_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_assignments" ADD CONSTRAINT "position_assignments_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_account_links" ADD CONSTRAINT "employee_account_links_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: Prisma cannot express these. Do not remove.

-- Occupational roles (FR-001). Keep in sync with ROLES in src/lib/roles.ts.
INSERT INTO "occupational_roles" ("code", "label") VALUES
  ('PDG', 'Pedagoga'),
  ('PSI', 'Psicòloga'),
  ('ER', 'Educadora referent'),
  ('TFM', 'Treballadora familiar de matins'),
  ('TFT', 'Treballadora familiar de tardes'),
  ('ET', 'Educadora de tardes'),
  ('ECS', 'Educadora de cap de setmana'),
  ('EN', 'Educadora de nit'),
  ('CT', 'Corretor')
ON CONFLICT ("code") DO NOTHING;

-- Positions: the label is trimmed and label_key (lower case) is derived here,
-- so House-local uniqueness ignores case and spaces even for direct SQL.
-- House and role are frozen after creation (SQLSTATE CI002).
CREATE FUNCTION "positions_normalise_and_freeze"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."house_id" IS DISTINCT FROM OLD."house_id" OR NEW."role_code" IS DISTINCT FROM OLD."role_code") THEN
    RAISE EXCEPTION 'position house and role are immutable' USING ERRCODE = 'CI002';
  END IF;
  NEW."label" := btrim(NEW."label", E' \t\r\n');
  NEW."label_key" := lower(NEW."label");
  RETURN NEW;
END $$;

CREATE TRIGGER "positions_normalise_and_freeze"
  BEFORE INSERT OR UPDATE ON "positions"
  FOR EACH ROW EXECUTE FUNCTION "positions_normalise_and_freeze"();

ALTER TABLE "positions"
  ADD CONSTRAINT "positions_label_not_blank" CHECK ("label" <> '');

-- Assignments: valid period, one position per employee and one occupant per
-- position on any date (BR-004).
ALTER TABLE "position_assignments"
  ADD CONSTRAINT "position_assignments_period_check"
  CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");

ALTER TABLE "position_assignments"
  ADD CONSTRAINT "position_assignments_employee_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    daterange("starts_on", "ends_on", '[]') WITH &&
  );

ALTER TABLE "position_assignments"
  ADD CONSTRAINT "position_assignments_position_no_overlap"
  EXCLUDE USING gist (
    "position_id" WITH =,
    daterange("starts_on", "ends_on", '[]') WITH &&
  );

-- Containment (BR-003): every assignment lies inside one membership of the same
-- employee and House. Checked at commit (deferred), after locking the employee
-- row so concurrent writes for one person serialise. SQLSTATE CI001.
CREATE FUNCTION "assert_assignments_within_membership"(p_employee uuid, p_house uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  bad uuid;
BEGIN
  PERFORM 1 FROM "employees" WHERE "id" = p_employee FOR UPDATE;
  SELECT a."id" INTO bad
    FROM "position_assignments" a
   WHERE a."employee_id" = p_employee
     AND a."house_id" = p_house
     AND NOT EXISTS (
       SELECT 1 FROM "house_memberships" m
        WHERE m."employee_id" = a."employee_id"
          AND m."house_id" = a."house_id"
          AND m."starts_on" <= a."starts_on"
          AND COALESCE(m."ends_on", 'infinity'::date) >= COALESCE(a."ends_on", 'infinity'::date)
     )
   LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'assignment % is outside its membership', bad USING ERRCODE = 'CI001';
  END IF;
END $$;

CREATE FUNCTION "position_assignments_check_containment"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM "assert_assignments_within_membership"(NEW."employee_id", NEW."house_id");
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "position_assignments_within_membership"
  AFTER INSERT OR UPDATE ON "position_assignments"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "position_assignments_check_containment"();

CREATE FUNCTION "house_memberships_check_containment"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM "assert_assignments_within_membership"(OLD."employee_id", OLD."house_id");
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "house_memberships_keep_assignments"
  AFTER UPDATE OR DELETE ON "house_memberships"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "house_memberships_check_containment"();

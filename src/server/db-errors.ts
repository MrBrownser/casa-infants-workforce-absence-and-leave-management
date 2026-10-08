// Maps Postgres errors surfaced by Prisma 7's pg driver adapter to staffing
// reasons. Model operations wrap the database error in a
// PrismaClientKnownRequestError (meta.driverAdapterError.cause); exclusion
// constraints, CHECKs, triggers and deferred triggers at commit arrive as a
// bare DriverAdapterError (cause). Never log the original message: it can
// contain record keys.
import { StaffingError, type StaffingErrorReason } from '@/lib/staffing-error';

export type PgError = { code: string; constraint: string | null };

type Cause = { originalCode?: unknown; originalMessage?: unknown };

export function pgErrorOf(error: unknown): PgError | null {
  if (typeof error !== 'object' || error === null) return null;
  const e = error as { name?: unknown; cause?: Cause; meta?: { driverAdapterError?: { cause?: Cause } } };
  const cause = e.name === 'DriverAdapterError' ? e.cause : e.meta?.driverAdapterError?.cause;
  if (!cause || typeof cause.originalCode !== 'string') return null;
  const message = typeof cause.originalMessage === 'string' ? cause.originalMessage : '';
  return { code: cause.originalCode, constraint: /constraint "([^"]+)"/.exec(message)?.[1] ?? null };
}

const CONSTRAINT_REASONS: Record<string, StaffingErrorReason> = {
  house_memberships_no_overlap: 'membership-overlap',
  house_memberships_period_check: 'invalid-dates',
  position_assignments_employee_no_overlap: 'employee-has-position',
  position_assignments_position_no_overlap: 'position-occupied',
  position_assignments_period_check: 'invalid-dates',
  positions_house_id_label_key_key: 'label-taken',
};

export function isReceiptConflict(error: unknown): boolean {
  const pg = pgErrorOf(error);
  return pg?.code === '23505' && pg.constraint === 'operation_receipts_pkey';
}

/** A StaffingError for known database failures; anything else is returned unchanged. */
export function toStaffingError(error: unknown): unknown {
  if (error instanceof StaffingError) return error;
  if ((error as { code?: unknown } | null)?.code === 'P2025') return new StaffingError('not-found');
  const pg = pgErrorOf(error);
  if (!pg) return error;
  if (pg.code === 'CI001') return new StaffingError('outside-membership');
  // CI002 never comes from the app (it never sends House or role on update);
  // 23503 and 22P02 mean an ID that does not exist or is malformed.
  if (pg.code === 'CI002' || pg.code === '23503' || pg.code === '22P02') return new StaffingError('not-found');
  const reason = pg.constraint ? CONSTRAINT_REASONS[pg.constraint] : undefined;
  return reason ? new StaffingError(reason) : error;
}

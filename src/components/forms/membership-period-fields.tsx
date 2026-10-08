import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import type { PositionRow } from '@/lib/staffing-views';
import { Field, describedBy } from './field';
import { PositionSelect } from './position-select';

type PeriodValues = { startsOn: string; endsOn?: string | null; positionId?: string | null };

/** Start, optional end and optional position of a membership period; shared by the new-person and existing-person forms. */
export function MembershipPeriodFields<T extends PeriodValues>({
  register,
  errors,
  houseName,
  positions,
}: Readonly<{ register: UseFormRegister<T>; errors: FieldErrors<T>; houseName: string; positions: readonly PositionRow[] }>) {
  // The generic keys are known to exist on T; react-hook-form cannot narrow them through a generic.
  const reg = register as unknown as UseFormRegister<PeriodValues>;
  const err = errors as FieldErrors<PeriodValues>;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="startsOn" label={`Inici a ${houseName}`} error={err.startsOn?.message}>
          <Input type="date" className="tabular-nums" {...describedBy('startsOn', err.startsOn?.message)} {...reg('startsOn')} />
        </Field>
        <Field id="endsOn" label="Final (opcional)" error={err.endsOn?.message}>
          <Input type="date" className="tabular-nums" {...describedBy('endsOn', err.endsOn?.message)} {...reg('endsOn')} />
        </Field>
      </div>
      <Field id="positionId" label="Lloc (opcional)" error={err.positionId?.message}>
        <PositionSelect positions={positions} {...describedBy('positionId', err.positionId?.message)} {...reg('positionId')} />
      </Field>
    </>
  );
}

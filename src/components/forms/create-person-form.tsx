'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import type { StaffingAction } from '@/lib/action-state';
import type { IsoDate } from '@/lib/dates';
import { createPersonSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import type { PositionRow } from '@/lib/staffing-views';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { MembershipPeriodFields } from './membership-period-fields';
import { SubmitButton } from './submit-button';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

type Schema = typeof createPersonSchema;

/** A new person with an initial membership in this House and an optional position, saved together (FR-002). */
export function CreatePersonForm({
  action,
  houseName,
  today,
  positions,
}: Readonly<{ action: StaffingAction; houseName: string; today: IsoDate; positions: readonly PositionRow[] }>) {
  const operationId = useOperationId();
  const { state, pending, run } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>({
    resolver: zodResolver(createPersonSchema),
    defaultValues: { operationId, fullName: '', startsOn: today, endsOn: '', positionId: '' },
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => run(values))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <Field id="fullName" label="Nom complet" error={errors.fullName?.message}>
        <Input autoComplete="off" {...describedBy('fullName', errors.fullName?.message)} {...register('fullName')} />
      </Field>
      <MembershipPeriodFields register={register} errors={errors} houseName={houseName} positions={positions} />
      <div>
        <SubmitButton pending={pending}>Afegeix la persona</SubmitButton>
      </div>
    </form>
  );
}

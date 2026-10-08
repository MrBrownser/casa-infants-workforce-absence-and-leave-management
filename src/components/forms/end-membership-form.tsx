'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import type { StaffingAction } from '@/lib/action-state';
import { formatDateCa, type IsoDate } from '@/lib/dates';
import { endMembershipSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { TwoStepFooter } from './two-step-footer';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

type Schema = typeof endMembershipSchema;

/** Ends a membership; the preview lists the positions that close with it (FR-003, AC-016). Not erasure. */
export function EndMembershipForm({
  action,
  membership,
  houseName,
  today,
}: Readonly<{ action: StaffingAction; membership: { id: string; startsOn: IsoDate }; houseName: string; today: IsoDate }>) {
  const operationId = useOperationId();
  const { state, pending, run, preview, cancelPreview } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>({
    resolver: zodResolver(endMembershipSchema),
    defaultValues: { operationId, membershipId: membership.id, endsOn: today },
  });
  const confirm = handleSubmit((values) => run({ ...values, intent: 'confirm', planToken: preview?.planToken }));

  return (
    <form noValidate onSubmit={handleSubmit((values) => run({ ...values, intent: 'preview' }))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <p className="text-[0.9375rem] tabular-nums text-foreground">
        Pertinença a {houseName} des del {formatDateCa(membership.startsOn)}.
      </p>
      <fieldset disabled={preview !== null || pending} className="flex flex-col gap-4">
        <Field id="endsOn" label={`Últim dia a ${houseName}`} error={errors.endsOn?.message}>
          <Input type="date" className="tabular-nums" {...describedBy('endsOn', errors.endsOn?.message)} {...register('endsOn')} />
        </Field>
      </fieldset>
      <TwoStepFooter preview={preview} pending={pending} onConfirm={() => void confirm()} onCancel={cancelPreview} />
    </form>
  );
}

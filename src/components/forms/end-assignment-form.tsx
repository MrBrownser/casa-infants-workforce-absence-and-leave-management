'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import type { StaffingAction } from '@/lib/action-state';
import { formatDateCa, type IsoDate } from '@/lib/dates';
import { endAssignmentSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { SubmitButton } from './submit-button';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

type Schema = typeof endAssignmentSchema;

export function EndAssignmentForm({
  action,
  assignment,
  today,
}: Readonly<{ action: StaffingAction; assignment: { id: string; positionLabel: string; startsOn: IsoDate }; today: IsoDate }>) {
  const operationId = useOperationId();
  const { state, pending, run } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>({
    resolver: zodResolver(endAssignmentSchema),
    defaultValues: { operationId, assignmentId: assignment.id, endsOn: today },
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => run(values))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <p className="text-[0.9375rem] tabular-nums text-foreground">
        Lloc <span className="font-semibold">{assignment.positionLabel}</span>, des del {formatDateCa(assignment.startsOn)}.
      </p>
      <Field id="endsOn" label="Últim dia al lloc" error={errors.endsOn?.message}>
        <Input type="date" className="tabular-nums" {...describedBy('endsOn', errors.endsOn?.message)} {...register('endsOn')} />
      </Field>
      <div>
        <SubmitButton pending={pending}>Finalitza el lloc</SubmitButton>
      </div>
    </form>
  );
}

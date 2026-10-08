'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import type { StaffingAction } from '@/lib/action-state';
import { editNameSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { SubmitButton } from './submit-button';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

type Schema = typeof editNameSchema;

/** Name correction: same employee ID, no period changes; stale if someone renamed meanwhile. */
export function EditNameForm({
  action,
  employeeId,
  fullName,
  updatedAt,
}: Readonly<{ action: StaffingAction; employeeId: string; fullName: string; updatedAt: string }>) {
  const operationId = useOperationId();
  const { state, pending, run } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>({
    resolver: zodResolver(editNameSchema),
    defaultValues: { operationId, employeeId, fullName, expectedUpdatedAt: updatedAt },
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => run(values))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <Field id="fullName" label="Nom complet" error={errors.fullName?.message}>
        <Input autoComplete="off" {...describedBy('fullName', errors.fullName?.message)} {...register('fullName')} />
      </Field>
      <div>
        <SubmitButton pending={pending}>Desa el nom</SubmitButton>
      </div>
    </form>
  );
}

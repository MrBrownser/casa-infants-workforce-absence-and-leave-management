'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { StaffingAction } from '@/lib/action-state';
import { ROLES } from '@/lib/roles';
import { createPositionSchema, relabelPositionSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { SubmitButton } from './submit-button';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

/** A new position in this House: role and a House-unique label. House and role never change afterwards (FR-001). */
export function CreatePositionForm({ action }: Readonly<{ action: StaffingAction }>) {
  const operationId = useOperationId();
  const { state, pending, run } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<typeof createPositionSchema>, unknown, FormOutput<typeof createPositionSchema>>({
    resolver: zodResolver(createPositionSchema),
    defaultValues: { operationId, roleCode: 'ER', label: '' },
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => run(values))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="roleCode" label="Rol" error={errors.roleCode?.message}>
          <NativeSelect {...describedBy('roleCode', errors.roleCode?.message)} {...register('roleCode')}>
            {ROLES.map((role) => (
              <option key={role.code} value={role.code}>
                {role.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="label" label="Nom del lloc" error={errors.label?.message} hint="Per exemple: ER 2, CT nit.">
          <Input autoComplete="off" {...describedBy('label', errors.label?.message)} {...register('label')} />
        </Field>
      </div>
      <div>
        <SubmitButton pending={pending}>Crea el lloc</SubmitButton>
      </div>
    </form>
  );
}

export function RelabelPositionForm({ action, positionId, label }: Readonly<{ action: StaffingAction; positionId: string; label: string }>) {
  const operationId = useOperationId();
  const { state, pending, run } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<typeof relabelPositionSchema>, unknown, FormOutput<typeof relabelPositionSchema>>({
    resolver: zodResolver(relabelPositionSchema),
    defaultValues: { operationId, positionId, label },
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => run(values))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <Field id="label" label="Nom del lloc" error={errors.label?.message}>
        <Input autoComplete="off" {...describedBy('label', errors.label?.message)} {...register('label')} />
      </Field>
      <div>
        <SubmitButton pending={pending}>Desa el nom</SubmitButton>
      </div>
    </form>
  );
}

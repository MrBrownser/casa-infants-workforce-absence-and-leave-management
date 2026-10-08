'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { NativeSelect } from '@/components/ui/native-select';
import type { StaffingAction } from '@/lib/action-state';
import type { IsoDate } from '@/lib/dates';
import { addMembershipSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import type { EmployeeOption, PositionRow } from '@/lib/staffing-views';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { MembershipPeriodFields } from './membership-period-fields';
import { SubmitButton } from './submit-button';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

type Schema = typeof addMembershipSchema;

/** A new membership period for an existing person: a return after a gap, or someone from the other House (FR-003). */
export function AddMembershipForm({
  action,
  houseName,
  today,
  positions,
  employee,
  employees = [],
}: Readonly<{
  action: StaffingAction;
  houseName: string;
  today: IsoDate;
  positions: readonly PositionRow[];
  employee?: { id: string; fullName: string };
  employees?: readonly EmployeeOption[];
}>) {
  const operationId = useOperationId();
  const { state, pending, run } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>({
    resolver: zodResolver(addMembershipSchema),
    defaultValues: { operationId, employeeId: employee?.id ?? '', startsOn: today, endsOn: '', positionId: '' },
  });

  return (
    <form noValidate onSubmit={handleSubmit((values) => run(values))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      {employee ? (
        <p className="text-[0.9375rem] text-foreground">
          Nou període a {houseName} per a <span className="font-semibold">{employee.fullName}</span>.
        </p>
      ) : (
        <Field id="employeeId" label="Persona" error={errors.employeeId ? 'Tria una persona.' : undefined}>
          <NativeSelect {...describedBy('employeeId', errors.employeeId?.message)} {...register('employeeId')}>
            <option value="">Tria una persona</option>
            {employees.map((option) => (
              <option key={option.employeeId} value={option.employeeId}>
                {option.fullName}
                {option.currentHouseName ? ` (ara a ${option.currentHouseName})` : ''}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <MembershipPeriodFields register={register} errors={errors} houseName={houseName} positions={positions} />
      <div>
        <SubmitButton pending={pending}>Afegeix el període</SubmitButton>
      </div>
    </form>
  );
}

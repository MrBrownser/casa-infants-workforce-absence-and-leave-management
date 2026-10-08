'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { StaffingAction } from '@/lib/action-state';
import type { IsoDate } from '@/lib/dates';
import { handoverSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import type { MemberOption, PositionRow } from '@/lib/staffing-views';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { PositionSelect } from './position-select';
import { TwoStepFooter } from './two-step-footer';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

type Schema = typeof handoverSchema;

/**
 * Assign a vacant position, replace its occupant or move someone (FR-004).
 * From an employee page the position is chosen; from a position page the
 * incoming person is. Step one previews the D-1 / D boundary; step two confirms.
 */
export function HandoverForm({
  action,
  from,
  fixed,
  positions = [],
  members = [],
  intro,
  today,
}: Readonly<{
  action: StaffingAction;
  from: 'employee' | 'position';
  fixed: { positionId: string } | { employeeId: string };
  positions?: readonly PositionRow[];
  members?: readonly MemberOption[];
  intro: string;
  today: IsoDate;
}>) {
  const operationId = useOperationId();
  const { state, pending, run, preview, cancelPreview } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>({
    resolver: zodResolver(handoverSchema),
    defaultValues: {
      operationId,
      positionId: 'positionId' in fixed ? fixed.positionId : '',
      employeeId: 'employeeId' in fixed ? fixed.employeeId : '',
      startsOn: today,
      endsOn: '',
      from,
    },
  });
  const confirm = handleSubmit((values) => run({ ...values, intent: 'confirm', planToken: preview?.planToken }));

  return (
    <form noValidate onSubmit={handleSubmit((values) => run({ ...values, intent: 'preview' }))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <p className="text-[0.9375rem] text-foreground">{intro}</p>
      <fieldset disabled={preview !== null || pending} className="flex flex-col gap-4">
        {from === 'employee' ? (
          <Field id="positionId" label="Lloc" error={errors.positionId ? 'Tria un lloc.' : undefined}>
            <PositionSelect positions={positions} emptyLabel="Tria un lloc" {...describedBy('positionId', errors.positionId?.message)} {...register('positionId')} />
          </Field>
        ) : (
          <Field id="employeeId" label="Persona que entra" error={errors.employeeId ? 'Tria una persona.' : undefined}>
            <NativeSelect {...describedBy('employeeId', errors.employeeId?.message)} {...register('employeeId')}>
              <option value="">Tria una persona</option>
              {members.map((member) => (
                <option key={member.employeeId} value={member.employeeId}>
                  {member.fullName}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="startsOn" label="Primer dia al lloc" error={errors.startsOn?.message}>
            <Input type="date" className="tabular-nums" {...describedBy('startsOn', errors.startsOn?.message)} {...register('startsOn')} />
          </Field>
          <Field id="endsOn" label="Últim dia (opcional)" error={errors.endsOn?.message} hint="Deixa-ho buit si no té data de final.">
            <Input type="date" className="tabular-nums" {...describedBy('endsOn', errors.endsOn?.message)} {...register('endsOn')} />
          </Field>
        </div>
      </fieldset>
      <TwoStepFooter preview={preview} pending={pending} onConfirm={() => void confirm()} onCancel={cancelPreview} />
    </form>
  );
}

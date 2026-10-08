'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import type { StaffingAction } from '@/lib/action-state';
import type { IsoDate } from '@/lib/dates';
import type { HouseSlug } from '@/lib/houses';
import { transferSchema, type FormInput, type FormOutput } from '@/lib/staffing-schemas';
import type { PositionRow } from '@/lib/staffing-views';
import { Field, describedBy } from './field';
import { FormStatus } from './form-status';
import { PositionSelect } from './position-select';
import { TwoStepFooter } from './two-step-footer';
import { useOperationId } from './use-operation-id';
import { useStaffingAction } from './use-staffing-action';

type Schema = typeof transferSchema;

/** House transfer with an optional destination position (FR-006). Lists change only from the effective date. */
export function TransferForm({
  action,
  employeeId,
  fromHouseName,
  toHouse,
  destinationPositions,
  today,
}: Readonly<{
  action: StaffingAction;
  employeeId: string;
  fromHouseName: string;
  toHouse: { slug: HouseSlug; name: string };
  destinationPositions: readonly PositionRow[];
  today: IsoDate;
}>) {
  const operationId = useOperationId();
  const { state, pending, run, preview, cancelPreview } = useStaffingAction(action);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput<Schema>, unknown, FormOutput<Schema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { operationId, employeeId, toHouseSlug: toHouse.slug, startsOn: today, destinationPositionId: '' },
  });
  const confirm = handleSubmit((values) => run({ ...values, intent: 'confirm', planToken: preview?.planToken }));

  return (
    <form noValidate onSubmit={handleSubmit((values) => run({ ...values, intent: 'preview' }))} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <p className="text-[0.9375rem] font-medium text-foreground">
        De {fromHouseName} a {toHouse.name}
      </p>
      <fieldset disabled={preview !== null || pending} className="flex flex-col gap-4">
        <Field
          id="startsOn"
          label={`Primer dia a ${toHouse.name}`}
          error={errors.startsOn?.message}
          hint={`L'últim dia a ${fromHouseName} serà el dia anterior.`}
        >
          <Input type="date" className="tabular-nums" {...describedBy('startsOn', errors.startsOn?.message)} {...register('startsOn')} />
        </Field>
        <Field id="destinationPositionId" label={`Lloc a ${toHouse.name} (opcional)`} error={errors.destinationPositionId?.message}>
          <PositionSelect
            positions={destinationPositions}
            {...describedBy('destinationPositionId', errors.destinationPositionId?.message)}
            {...register('destinationPositionId')}
          />
        </Field>
      </fieldset>
      <TwoStepFooter preview={preview} pending={pending} onConfirm={() => void confirm()} onCancel={cancelPreview} />
    </form>
  );
}

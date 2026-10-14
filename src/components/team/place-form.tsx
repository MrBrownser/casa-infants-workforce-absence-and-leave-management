'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRightLeft, UserCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { movePersonAction, reactivatePersonAction } from '@/app/(app)/[house]/team/actions';
import { ErrorText, Field, SuccessText } from '@/components/field';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import type { HouseSlug } from '@/lib/houses';
import { placePersonSchema } from '@/lib/people-schemas';
import type { SeatOption } from '@/lib/team';
import { useServerAction } from './use-server-action';

/** Move an active person, or reactivate an inactive one, into a vacant seat of either House. */
export function PlaceForm({
  houseSlug,
  personId,
  vacantSeats,
  mode,
}: Readonly<{ houseSlug: HouseSlug; personId: string; vacantSeats: readonly SeatOption[]; mode: 'move' | 'reactivate' }>) {
  const { error, saved, pending, run } = useServerAction();
  const form = useForm<z.input<typeof placePersonSchema>, unknown, z.output<typeof placePersonSchema>>({
    resolver: zodResolver(placePersonSchema),
    defaultValues: { personId, seat: '' },
  });
  const fieldError = form.formState.errors.seat?.message;
  const action = mode === 'move' ? movePersonAction : reactivatePersonAction;
  // On success the chosen seat leaves the vacant list: clear it so a second submit cannot resend it.
  const onSubmit = form.handleSubmit(() =>
    run(() => action(houseSlug, form.getValues()), () => form.reset({ personId, seat: '' })),
  );

  if (vacantSeats.length === 0) {
    return <p className="text-[0.875rem] text-muted-foreground">No hi ha cap lloc vacant.</p>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <Field id={`${mode}-seat`} label="Lloc vacant" error={fieldError}>
        <NativeSelect
          id={`${mode}-seat`}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? `${mode}-seat-error` : undefined}
          {...form.register('seat')}
        >
          <option value="" disabled>
            Tria un lloc
          </option>
          {vacantSeats.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {error && <ErrorText>{error}</ErrorText>}
      {saved && <SuccessText>Fet.</SuccessText>}
      <Button type="submit" variant="secondary" size="sm" disabled={pending} className="self-start">
        {mode === 'move' ? <ArrowRightLeft aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
        {mode === 'move' ? 'Mou' : 'Reincorpora'}
      </Button>
    </form>
  );
}

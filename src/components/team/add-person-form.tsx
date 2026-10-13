'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { addPersonAction } from '@/app/(app)/[house]/team/actions';
import { DateInput } from '@/components/date-input';
import { ErrorText, Field } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { HouseSlug } from '@/lib/houses';
import { addPersonSchema } from '@/lib/people-schemas';
import { useServerAction } from './use-server-action';

export function AddPersonForm({ houseSlug, seat, onDone }: Readonly<{ houseSlug: HouseSlug; seat: string; onDone: () => void }>) {
  const { error, pending, run } = useServerAction();
  const form = useForm<z.input<typeof addPersonSchema>, unknown, z.output<typeof addPersonSchema>>({
    resolver: zodResolver(addPersonSchema),
    defaultValues: { fullName: '', startedOn: '', seat },
  });
  const { errors } = form.formState;
  // The server re-parses the raw values with the same schema.
  const onSubmit = form.handleSubmit(() => run(() => addPersonAction(houseSlug, form.getValues()), onDone));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Field id="add-full-name" label="Nom complet" error={errors.fullName?.message}>
        <Input
          id="add-full-name"
          data-autofocus
          autoComplete="off"
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={errors.fullName ? 'add-full-name-error' : undefined}
          {...form.register('fullName')}
        />
      </Field>
      <Field id="add-started-on" label="A la casa des del (opcional)" hint="dd/mm/aaaa" error={errors.startedOn?.message}>
        <Controller
          control={form.control}
          name="startedOn"
          render={({ field }) => (
            <DateInput
              id="add-started-on"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={errors.startedOn ? true : undefined}
              aria-describedby={errors.startedOn ? 'add-started-on-error' : undefined}
            />
          )}
        />
      </Field>
      {(error ?? errors.seat?.message) && <ErrorText>{error ?? errors.seat?.message}</ErrorText>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Desant…' : 'Afegeix'}
      </Button>
    </form>
  );
}

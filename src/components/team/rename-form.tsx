'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { renamePersonAction } from '@/app/(app)/[house]/team/actions';
import { ErrorText, Field, SuccessText } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { HouseSlug } from '@/lib/houses';
import { renamePersonSchema } from '@/lib/people-schemas';
import { useServerAction } from './use-server-action';

export function RenameForm({ houseSlug, personId, fullName }: Readonly<{ houseSlug: HouseSlug; personId: string; fullName: string }>) {
  const { error, saved, pending, run } = useServerAction();
  const form = useForm<z.input<typeof renamePersonSchema>, unknown, z.output<typeof renamePersonSchema>>({
    resolver: zodResolver(renamePersonSchema),
    defaultValues: { personId, fullName },
  });
  const fieldError = form.formState.errors.fullName?.message;
  const onSubmit = form.handleSubmit(() => run(() => renamePersonAction(houseSlug, form.getValues())));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <Field id="rename-full-name" label="Nom complet" error={fieldError}>
        <Input
          id="rename-full-name"
          autoComplete="off"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? 'rename-full-name-error' : undefined}
          {...form.register('fullName')}
        />
      </Field>
      {error && <ErrorText>{error}</ErrorText>}
      {saved && <SuccessText>Desat.</SuccessText>}
      <Button type="submit" variant="secondary" size="sm" disabled={pending} className="self-start">
        Desa el nom
      </Button>
    </form>
  );
}

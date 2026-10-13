'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { saveBalancesAction } from '@/app/(app)/[house]/team/actions';
import { DurationInput } from '@/components/duration-input';
import { ErrorText, Field, SuccessText } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDuration, toDurationText } from '@/lib/duration';
import type { HouseSlug } from '@/lib/houses';
import { balancesSchema } from '@/lib/people-schemas';
import type { PersonDetails } from '@/lib/team';
import { cn } from '@/lib/utils';
import { personHref } from './post-card';
import { useServerAction } from './use-server-action';

function Tile({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-xl bg-background p-3">
      <dt className="text-[0.75rem] text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function BalancesForm({ houseSlug, details }: Readonly<{ houseSlug: HouseSlug; details: PersonDetails }>) {
  const { person, year, balances } = details;
  const { error, saved, pending, run } = useServerAction();
  const form = useForm<z.input<typeof balancesSchema>, unknown, z.output<typeof balancesSchema>>({
    resolver: zodResolver(balancesSchema),
    defaultValues: {
      personId: person.id,
      year,
      vacationDays: String(balances.vacationDays),
      carriedDays: String(balances.carriedDays),
      surplusSign: balances.surplusMinutes < 0 ? '-' : '+',
      surplus: toDurationText(balances.surplusMinutes),
    },
  });
  const { errors } = form.formState;
  const sign = useWatch({ control: form.control, name: 'surplusSign' });
  const onSubmit = form.handleSubmit(() => run(() => saveBalancesAction(houseSlug, form.getValues())));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field id="balances-vacation" label="Dies de vacances" error={errors.vacationDays?.message}>
          <Input
            id="balances-vacation"
            inputMode="numeric"
            className="w-24 tabular-nums"
            aria-invalid={errors.vacationDays ? true : undefined}
            aria-describedby={errors.vacationDays ? 'balances-vacation-error' : undefined}
            {...form.register('vacationDays')}
          />
        </Field>
        <Field id="balances-carried" label="Dies AA (any anterior)" error={errors.carriedDays?.message}>
          <Input
            id="balances-carried"
            inputMode="numeric"
            className="w-24 tabular-nums"
            aria-invalid={errors.carriedDays ? true : undefined}
            aria-describedby={errors.carriedDays ? 'balances-carried-error' : undefined}
            {...form.register('carriedDays')}
          />
        </Field>
      </div>
      <Field id="balances-surplus" label="Excedent de calendari a l'inici de l'any" error={errors.surplus?.message}>
        <Controller
          control={form.control}
          name="surplus"
          render={({ field }) => (
            <DurationInput
              id="balances-surplus"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              sign={sign}
              onSignChange={(value) => form.setValue('surplusSign', value, { shouldDirty: true })}
              invalid={!!errors.surplus}
              describedBy={errors.surplus ? 'balances-surplus-error' : undefined}
            />
          )}
        />
      </Field>
      {error && <ErrorText>{error}</ErrorText>}
      {saved && <SuccessText>Desat.</SuccessText>}
      <Button type="submit" variant="secondary" size="sm" disabled={pending} className="self-start">
        Desa els saldos de {year}
      </Button>
    </form>
  );
}

/** Opening balances of one year (design D6): defaults until the director saves them. */
export function BalancesSection({
  houseSlug,
  details,
  currentYear,
}: Readonly<{ houseSlug: HouseSlug; details: PersonDetails; currentYear: number }>) {
  const { person, year, balances, stored } = details;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[0.9375rem]">Saldos d&apos;inici d&apos;any</h3>
        <nav aria-label="Any" className="inline-flex rounded-lg border border-border bg-background p-0.5">
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <Link
              key={y}
              href={personHref(houseSlug, person.id, y)}
              scroll={false}
              aria-current={y === year ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium tabular-nums transition-colors duration-150 ease-out',
                y === year ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {y}
            </Link>
          ))}
        </nav>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <Tile label="Vacances" value={`${balances.vacationDays} dies`} />
        <Tile label="Dies AA" value={String(balances.carriedDays)} />
        <Tile label="Excedent" value={formatDuration(balances.surplusMinutes, { signed: true })} />
      </dl>
      {!stored && <p className="text-[0.8125rem] text-muted-foreground">Encara no s&apos;han desat: són els valors per defecte.</p>}
      {/* key: switching year or saving restarts the form from the shown values. */}
      <BalancesForm key={`${person.id}-${year}-${balances.vacationDays}-${balances.carriedDays}-${balances.surplusMinutes}`} houseSlug={houseSlug} details={details} />
    </section>
  );
}

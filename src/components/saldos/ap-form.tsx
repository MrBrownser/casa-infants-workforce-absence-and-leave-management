'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Hourglass } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { addApAction } from '@/app/(app)/[house]/saldos/actions';
import { Callout } from '@/components/callout';
import { DateInput } from '@/components/date-input';
import { DurationInput } from '@/components/duration-input';
import { ErrorText, Field } from '@/components/field';
import { useServerAction } from '@/components/team/use-server-action';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { addApSchema } from '@/lib/ap-schemas';
import {
  AP_KINDS,
  AP_KIND_LABELS,
  MAX_REQUEST_MINUTES,
  checkNewAp,
  remainingFor,
  type ApKind,
  type PersonBalances,
} from '@/lib/balances';
import { parseDateDdMmYyyy } from '@/lib/dates';
import { formatDuration, parseDuration, toDurationText } from '@/lib/duration';
import type { HouseSlug } from '@/lib/houses';
import { AP_RULES } from '@/lib/rules';
import type { SaldoRow } from '@/lib/saldos';
import { cn } from '@/lib/utils';

const DESCRIPTIONS: Record<ApKind, string> = {
  non_recoverable: `Fins a ${formatDuration(AP_RULES.nonRecoverable.minutes)} l'any, en ${AP_RULES.nonRecoverable.maxDays} dies com a màxim.`,
  recoverable: `Es descompta de l'excedent de calendari. Fins a ${formatDuration(AP_RULES.recoverable.minutes)} en ${AP_RULES.recoverable.maxDays} dies.`,
};

type FormInput = z.input<typeof addApSchema>;
type FormOutput = z.output<typeof addApSchema>;

/** The hours a request starts with: the time left when it is the last one allowed (design D4), else nothing. */
function prefillHours(row: SaldoRow | undefined, kind: ApKind): string | null {
  const rest = row ? remainingFor(row.balances, kind) : null;
  return rest?.last ? toDurationText(rest.minutes) : null;
}

/** Minutes only when they make a valid request, so the live check does not repeat the field's own error. */
function requestMinutes(text: string): number | null {
  const minutes = parseDuration(text);
  return minutes !== null && minutes >= 1 && minutes <= MAX_REQUEST_MINUTES ? minutes : null;
}

function BalanceTiles({ name, balances: b, kind }: Readonly<{ name: string; balances: PersonBalances; kind: ApKind }>) {
  const tiles = [
    { key: 'vac', label: 'Vacances', value: `${b.vacationTotal} dies`, sub: b.carriedDays ? `inclou ${b.carriedDays} AA` : 'aquest any', on: false, warn: false },
    {
      key: 'apnr',
      label: 'AP no recuperables',
      value: formatDuration(b.nonRecoverable.leftMinutes),
      sub: `queden · ${b.nonRecoverable.count}/${b.nonRecoverable.maxCount} dies`,
      on: kind === 'non_recoverable',
      warn: false,
    },
    {
      key: 'apr',
      label: 'Excedent calendari',
      value: formatDuration(b.surplusMinutes, { signed: true }),
      sub: `AP rec.: ${b.recoverable.count}/${b.recoverable.maxCount} dies`,
      on: kind === 'recoverable',
      warn: b.surplusMinutes < 0,
    },
  ];
  return (
    <div className="-mt-2 flex flex-col gap-1.5">
      <p className="text-[0.8125rem] text-muted-foreground">Saldo de {name.split(' ')[0]}</p>
      <dl className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className={cn('rounded-lg p-2.5 transition-colors duration-150 ease-out', tile.on ? 'bg-secondary ring-1 ring-sage' : 'bg-background')}
          >
            <dt className="text-[0.75rem] leading-tight text-muted-foreground">{tile.label}</dt>
            <dd className="mt-1 flex items-center gap-1 font-semibold leading-tight tabular-nums">
              {tile.warn && <Hourglass aria-hidden="true" className="size-3.5 text-warning" />}
              {tile.value}
            </dd>
            <dd className="mt-0.5 text-[0.6875rem] leading-snug tabular-nums text-muted-foreground">{tile.sub}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Records an AP for the year shown (design D10). Rules are checked live and again on the server. */
export function ApForm({
  houseSlug,
  year,
  rows,
  initialPersonId,
  onSaved,
  onCancel,
}: Readonly<{
  houseSlug: HouseSlug;
  year: number;
  rows: readonly SaldoRow[];
  initialPersonId: string | null;
  onSaved: (saved: { id: string; text: string }) => void;
  onCancel: () => void;
}>) {
  const { error, pending, run } = useServerAction();
  const initialRow = rows.find((row) => row.person.id === initialPersonId);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(addApSchema),
    mode: 'onTouched',
    defaultValues: {
      personId: initialRow?.person.id ?? '',
      kind: 'non_recoverable',
      year,
      date: '',
      hours: prefillHours(initialRow, 'non_recoverable') ?? '',
    },
  });
  const { errors } = form.formState;
  const [personId, kind, dateText, hoursText] = useWatch({ control: form.control, name: ['personId', 'kind', 'date', 'hours'] });
  const row = rows.find((r) => r.person.id === personId);
  const rest = row ? remainingFor(row.balances, kind) : null;
  const check = row ? checkNewAp(row.balances, { kind, year, date: parseDateDdMmYyyy(dateText), minutes: requestMinutes(hoursText) }) : null;
  const blocked = !row || (check?.errors.length ?? 0) > 0;

  function prefill(nextPersonId: string, nextKind: ApKind) {
    const hours = prefillHours(
      rows.find((r) => r.person.id === nextPersonId),
      nextKind,
    );
    if (hours) form.setValue('hours', hours);
  }

  const onSubmit = form.handleSubmit((data) => {
    const name = row?.person.fullName ?? '';
    let id = '';
    run(
      async () => {
        const result = await addApAction(houseSlug, form.getValues());
        if (result.ok) id = result.data.id;
        return result;
      },
      () => onSaved({ id, text: `Apuntat ${AP_KIND_LABELS[data.kind]} de ${formatDuration(data.minutes)} a ${name}.` }),
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col">
      <div className="flex flex-col gap-5 px-5 py-5 md:px-6">
        <Field id="ap-person" label="Persona" error={errors.personId?.message}>
          <Controller
            control={form.control}
            name="personId"
            render={({ field }) => (
              <NativeSelect
                id="ap-person"
                data-autofocus={initialRow ? undefined : true}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(event) => {
                  field.onChange(event.target.value);
                  prefill(event.target.value, kind);
                }}
                aria-invalid={errors.personId ? true : undefined}
                aria-describedby={errors.personId ? 'ap-person-error' : undefined}
              >
                <option value="" disabled>
                  Tria una persona
                </option>
                {rows.map((r) => (
                  <option key={r.person.id} value={r.person.id}>
                    {r.person.fullName}
                  </option>
                ))}
              </NativeSelect>
            )}
          />
        </Field>

        {row && <BalanceTiles name={row.person.fullName} balances={row.balances} kind={kind} />}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-foreground">Què apuntes?</legend>
          {AP_KINDS.map((value) => (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors duration-150 ease-out',
                kind === value ? 'border-primary ring-1 ring-primary' : 'border-border hover:bg-hover',
              )}
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => {
                  form.setValue('kind', value);
                  prefill(personId, value);
                }}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block font-semibold">{AP_KIND_LABELS[value]}</span>
                <span className="text-[0.8125rem] text-muted-foreground">{DESCRIPTIONS[value]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field id="ap-date" label="Dia" error={errors.date?.message}>
            <Controller
              control={form.control}
              name="date"
              render={({ field }) => (
                <DateInput
                  id="ap-date"
                  data-autofocus={initialRow ? true : undefined}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={errors.date ? true : undefined}
                  aria-describedby={errors.date ? 'ap-date-error' : undefined}
                />
              )}
            />
          </Field>
          <Field
            id="ap-hours"
            label="Hores"
            hint={rest?.last ? `És l'últim dia: li queden ${formatDuration(rest.minutes)}` : undefined}
            error={errors.hours?.message}
          >
            <Controller
              control={form.control}
              name="hours"
              render={({ field }) => (
                <DurationInput
                  id="ap-hours"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={!!errors.hours}
                  describedBy={errors.hours ? 'ap-hours-error' : undefined}
                />
              )}
            />
            {rest && !rest.last && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start tabular-nums"
                onClick={() => form.setValue('hours', toDurationText(rest.minutes), { shouldValidate: true })}
              >
                La resta ({formatDuration(rest.minutes)})
              </Button>
            )}
          </Field>
        </div>

        <div aria-live="polite" className="flex flex-col gap-2">
          {check?.errors.map((message) => (
            <Callout key={message} tone="error">
              {message}
            </Callout>
          ))}
          {check && check.errors.length === 0 && check.notices.map((message) => (
            <Callout key={message} tone="warning">
              {message}
            </Callout>
          ))}
          {check && check.errors.length === 0 && check.preview && <Callout tone="success">{check.preview}</Callout>}
          {error && <ErrorText>{error}</ErrorText>}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border bg-background/50 px-5 py-4 sm:flex-row sm:justify-end md:px-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel·la
        </Button>
        <Button type="submit" disabled={pending || blocked}>
          Apunta-ho
        </Button>
      </div>
    </form>
  );
}

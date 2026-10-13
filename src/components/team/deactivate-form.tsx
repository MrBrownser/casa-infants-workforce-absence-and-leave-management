'use client';

import { useState } from 'react';
import { UserMinus } from 'lucide-react';
import { deactivatePersonAction } from '@/app/(app)/[house]/team/actions';
import { ErrorText } from '@/components/field';
import { Button } from '@/components/ui/button';
import type { HouseSlug } from '@/lib/houses';
import { useServerAction } from './use-server-action';

/** Frees the seat and keeps the person's data and balances (no delete: spec). Asks first. */
export function DeactivateForm({ houseSlug, personId, fullName }: Readonly<{ houseSlug: HouseSlug; personId: string; fullName: string }>) {
  const [confirming, setConfirming] = useState(false);
  const { error, pending, run } = useServerAction();

  if (!confirming) {
    return (
      <Button type="button" variant="destructive" size="sm" className="self-start" onClick={() => setConfirming(true)}>
        <UserMinus aria-hidden="true" />
        Passa a antics membres
      </Button>
    );
  }

  return (
    <div role="group" aria-label="Confirmació" className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <p className="text-[0.875rem]">
        {fullName} deixarà el lloc vacant. Es guarden les seves dades i saldos, i la pots reincorporar quan torni.
      </p>
      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => run(() => deactivatePersonAction(houseSlug, { personId }))}
        >
          Sí, deixa el lloc vacant
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel·la
        </Button>
      </div>
    </div>
  );
}

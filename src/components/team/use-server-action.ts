'use client';

import { unstable_rethrow } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/action-result';

/** Shown when a Server Function throws unexpectedly (database outage, network failure). */
export const SAVE_FAILED_MESSAGE = "No s'ha pogut desar. Torna-ho a provar d'aquí a una estona.";

/** Runs a Server Function in a transition and keeps its Catalan error or "saved" state. */
export function useServerAction() {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          setSaved(true);
          onSuccess?.();
        } else {
          setError(result.message);
        }
      } catch (err) {
        // Let redirect() and notFound() (for example the /no-access redirect) keep working.
        unstable_rethrow(err);
        console.error(err);
        setError(SAVE_FAILED_MESSAGE);
      }
    });
  }

  return { error, saved, pending, run };
}

'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/action-result';

/** Runs a Server Function in a transition and keeps its Catalan error or "saved" state. */
export function useServerAction() {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setSaved(true);
        onSuccess?.();
      } else {
        setError(result.message);
      }
    });
  }

  return { error, saved, pending, run };
}

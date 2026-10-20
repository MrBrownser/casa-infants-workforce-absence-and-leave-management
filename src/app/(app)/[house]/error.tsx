'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { HouseMark } from '@/components/house-mark';
import { Button } from '@/components/ui/button';

/**
 * Error boundary for the House-scoped area: unexpected server errors, in Catalan.
 * It renders inside the House layout (top bar and tab bar already there).
 */
export default function HouseError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // Caught by this boundary, so not reported on its own (no-op without a DSN).
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-8">
      <HouseMark className="size-24" />
      <div
        role="alert"
        className="flex items-center gap-2 rounded-lg bg-error-bg px-3 py-2 text-sm font-medium text-error"
      >
        <TriangleAlert aria-hidden="true" className="size-4" />
        Error inesperat
      </div>
      <h1 className="text-[1.875rem] tracking-[-0.015em]">Alguna cosa ha anat malament</h1>
      <p className="text-[0.9375rem] leading-[1.65] text-muted-foreground">
        No hem pogut carregar aquesta pàgina. Torna-ho a provar d&apos;aquí a una estona.
      </p>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button className="min-h-11 rounded-lg" onClick={() => unstable_retry()}>
          Torna-ho a provar
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-lg">
          <Link href="/dashboard">Torna a l&apos;inici</Link>
        </Button>
      </div>
    </main>
  );
}

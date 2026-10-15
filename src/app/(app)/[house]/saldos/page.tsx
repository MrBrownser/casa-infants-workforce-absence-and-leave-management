import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SaldosContent } from './saldos-content';

export const metadata: Metadata = {
  title: "Saldos · Casa d'Infants",
};

// The frame renders at once; everything that reads the request (params,
// searchParams, the director check and the balances) is inside <Suspense>, so
// the page survives Cache Components (AGENTS.md).
export default function SaldosPage(
  props: Readonly<{
    params: Promise<{ house: string }>;
    searchParams: Promise<{ year?: string | string[]; person?: string | string[] }>;
  }>,
) {
  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-10 sm:px-8">
      <Suspense fallback={<p className="text-muted-foreground">Carregant els saldos…</p>}>
        <SaldosContent {...props} />
      </Suspense>
    </main>
  );
}

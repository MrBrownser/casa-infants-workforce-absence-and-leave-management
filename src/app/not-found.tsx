import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { HouseMark } from '@/components/house-mark';
import { TopBar } from '@/components/top-bar';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: "Pàgina no trobada · Casa d'Infants" };

/**
 * Root 404: unmatched URLs and unknown House slugs. Renders inside the root
 * layout only, so it must not use auth, Clerk or DB APIs.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-8">
        <HouseMark className="size-24" />
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-medium text-muted-foreground">
          <SearchX aria-hidden="true" className="size-4" />
          <span>Error 404</span>
        </div>
        <h1 className="text-[1.875rem] tracking-[-0.015em]">No hem trobat aquesta pàgina</h1>
        <p className="text-[0.9375rem] leading-[1.65] text-muted-foreground">
          Potser l&apos;adreça no és correcta o la pàgina ja no existeix.
        </p>
        <Button asChild className="min-h-11 w-full rounded-lg sm:w-auto">
          <Link href="/dashboard">Torna a l&apos;inici</Link>
        </Button>
      </main>
    </div>
  );
}

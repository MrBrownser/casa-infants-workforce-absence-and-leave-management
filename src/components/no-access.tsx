import { UserButton } from '@clerk/nextjs';
import { Lock } from 'lucide-react';
import { HouseMark } from '@/components/house-mark';
import { TopBar } from '@/components/top-bar';

/** Shown to signed-in users without the director flag (temporary gate, see src/lib/auth.ts). */
export function NoAccess() {
  return (
    <div className="min-h-screen bg-background">
      <TopBar>
        <UserButton />
      </TopBar>
      <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-8">
        <HouseMark className="size-24" />
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-error-bg px-3 py-2 text-sm font-medium text-error"
        >
          <Lock aria-hidden="true" className="size-4" />
          Sense accés
        </div>
        <h1 className="text-[1.875rem] tracking-[-0.015em]">Aquesta zona és només per a la direcció</h1>
        <p className="text-[0.9375rem] leading-[1.65] text-muted-foreground">
          El teu compte no té permís per veure les cases. Si creus que és un error, parla amb la direcció.
        </p>
      </main>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users } from 'lucide-react';
import type { HouseSlug } from '@/lib/houses';
import { cn } from '@/lib/utils';

// House sections. New House-scoped features add an entry here and a route
// under src/app/(app)/[house]/<segment>.
export const SECTIONS = [
  { segment: '', label: 'Inici', icon: Home },
  { segment: 'team', label: 'Equip', icon: Users },
] as const;

export function sectionHref(houseSlug: HouseSlug, segment: string): string {
  return segment ? `/${houseSlug}/${segment}` : `/${houseSlug}`;
}

function isCurrent(pathname: string, houseSlug: HouseSlug, segment: string): boolean {
  const href = sectionHref(houseSlug, segment);
  return segment ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
}

/** Desktop: nav pills in the top bar. */
export function SectionNav({ houseSlug }: Readonly<{ houseSlug: HouseSlug }>) {
  const pathname = usePathname();
  return (
    <nav aria-label="Seccions" className="flex items-center gap-1">
      {SECTIONS.map(({ segment, label }) => {
        const current = isCurrent(pathname, houseSlug, segment);
        return (
          <Link
            key={label}
            href={sectionHref(houseSlug, segment)}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out',
              current ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-hover hover:text-foreground',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile: bottom tab bar (DESIGN.md: no sidebar). */
export function BottomTabBar({ houseSlug }: Readonly<{ houseSlug: HouseSlug }>) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Seccions"
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {SECTIONS.map(({ segment, label, icon: Icon }) => {
        const current = isCurrent(pathname, houseSlug, segment);
        return (
          <Link
            key={label}
            href={sectionHref(houseSlug, segment)}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors duration-150 ease-out',
              current ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

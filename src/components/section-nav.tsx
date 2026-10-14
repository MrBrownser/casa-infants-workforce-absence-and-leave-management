'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Scale, Sun, Users } from 'lucide-react';
import type { HouseSlug } from '@/lib/houses';
import { SECTIONS, sectionHref } from '@/lib/sections';
import { cn } from '@/lib/utils';

// Same icons as the prototypes (public/prototypes/shared/ui.js).
const ICONS = { saldos: Scale, vacances: Sun, mes: CalendarDays, team: Users } as const;

function iconOf(segment: string) {
  return ICONS[segment as keyof typeof ICONS] ?? Users;
}

function isCurrent(pathname: string, houseSlug: HouseSlug, segment: string): boolean {
  const href = sectionHref(houseSlug, segment);
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop: nav pills in the top bar. Sections not built yet show "aviat" and are not links. */
export function SectionNav({ houseSlug }: Readonly<{ houseSlug: HouseSlug }>) {
  const pathname = usePathname();
  return (
    <nav aria-label="Seccions" className="flex items-center gap-1">
      {SECTIONS.map(({ segment, label, available }) => {
        if (!available) {
          return (
            <span
              key={segment}
              aria-disabled="true"
              title="Aviat"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground/60"
            >
              {label}
              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-sage-foreground">
                aviat
              </span>
            </span>
          );
        }
        const current = isCurrent(pathname, houseSlug, segment);
        return (
          <Link
            key={segment}
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

/** Mobile: bottom tab bar (DESIGN.md: no sidebar). Sections not built yet are dimmed. */
export function BottomTabBar({ houseSlug }: Readonly<{ houseSlug: HouseSlug }>) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Seccions"
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {SECTIONS.map(({ segment, label, available }) => {
        const Icon = iconOf(segment);
        const base = 'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium';
        if (!available) {
          return (
            <span key={segment} aria-disabled="true" className={cn(base, 'text-muted-foreground/50')}>
              <Icon aria-hidden="true" className="size-5" />
              {label}
              <span className="sr-only"> (aviat)</span>
            </span>
          );
        }
        const current = isCurrent(pathname, houseSlug, segment);
        return (
          <Link
            key={segment}
            href={sectionHref(houseSlug, segment)}
            aria-current={current ? 'page' : undefined}
            className={cn(base, 'transition-colors duration-150 ease-out', current ? 'text-primary' : 'text-muted-foreground')}
          >
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

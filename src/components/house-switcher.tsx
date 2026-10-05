'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HOUSES, switchHousePath, type HouseSlug } from '@/lib/houses';
import { cn } from '@/lib/utils';

/**
 * Two-option segmented control: both Houses are always visible, so the active
 * one is unmistakable (FR-002). Plain links, so switching writes nothing.
 */
export function HouseSwitcher({ activeSlug, className }: Readonly<{ activeSlug: HouseSlug; className?: string }>) {
  const pathname = usePathname();

  return (
    <nav aria-label="Casa" className={cn('inline-flex rounded-lg border border-border bg-background p-0.5', className)}>
      {HOUSES.map((house) => {
        const active = house.slug === activeSlug;
        return (
          <Link
            key={house.slug}
            href={switchHousePath(pathname, house.slug)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors duration-150 ease-out md:min-h-8',
              active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {house.name}
          </Link>
        );
      })}
    </nav>
  );
}

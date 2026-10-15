import Link from 'next/link';
import type { HouseSlug } from '@/lib/houses';
import { saldosHref } from '@/lib/saldos';
import { cn } from '@/lib/utils';

/** Previous, current and next year, kept in the URL (`?year=`). */
export function YearSwitcher({ houseSlug, year, currentYear }: Readonly<{ houseSlug: HouseSlug; year: number; currentYear: number }>) {
  return (
    <nav aria-label="Any" className="inline-flex self-start rounded-lg border border-border bg-background p-0.5">
      {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
        <Link
          key={y}
          href={saldosHref(houseSlug, y)}
          scroll={false}
          aria-current={y === year ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium tabular-nums transition-colors duration-150 ease-out',
            y === year ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {y}
        </Link>
      ))}
    </nav>
  );
}

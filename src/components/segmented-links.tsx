import Link from 'next/link';
import { cn } from '@/lib/utils';

/** A segmented control made of links (state lives in the URL). Selected = Salvia, never honey. */
export function SegmentedLinks({
  label,
  items,
}: Readonly<{ label: string; items: readonly { href: string; label: string; current: boolean }[] }>) {
  return (
    <nav aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-background p-0.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.current ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors duration-150 ease-out md:min-h-8',
            item.current ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

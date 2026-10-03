import Link from 'next/link';
import { HouseMark } from '@/components/house-mark';

/**
 * Contextual top bar (no sidebar, see DESIGN.md): house mark + wordmark on the
 * left, breadcrumb in the middle, actions on the right.
 */
export function TopBar({
  breadcrumb,
  children,
}: Readonly<{ breadcrumb?: React.ReactNode; children?: React.ReactNode }>) {
  return (
    <nav className="sticky top-0 z-50 flex h-[58px] items-center gap-4 border-b border-border bg-card px-4 sm:px-6">
      <Link
        href="/"
        className="font-display flex items-center gap-2 whitespace-nowrap text-[1.125rem] font-semibold tracking-[-0.01em] text-foreground"
      >
        <HouseMark className="size-7" />
        Casa d&apos;Infants
      </Link>
      <div className="hidden flex-1 items-center gap-1.5 overflow-hidden text-sm font-medium text-muted-foreground sm:flex">
        {breadcrumb}
      </div>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </nav>
  );
}

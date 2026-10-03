import Link from 'next/link';

/**
 * Contextual top bar (no sidebar, see DESIGN.md): wordmark on the left,
 * breadcrumb in the middle, actions on the right.
 */
export function TopBar({
  breadcrumb,
  children,
}: Readonly<{ breadcrumb?: React.ReactNode; children?: React.ReactNode }>) {
  return (
    <nav className="sticky top-0 z-50 flex h-[52px] items-center gap-4 border-b border-border bg-card px-6">
      <Link
        href="/"
        className="whitespace-nowrap text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-primary"
      >
        Casa d&apos;Infants
      </Link>
      <div className="flex flex-1 items-center gap-1.5 overflow-hidden text-[0.8125rem] font-medium text-muted-foreground">
        {breadcrumb}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </nav>
  );
}

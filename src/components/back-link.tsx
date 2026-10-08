import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function BackLink({ href, children }: Readonly<{ href: string; children: React.ReactNode }>) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground md:min-h-8">
      <ArrowLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}

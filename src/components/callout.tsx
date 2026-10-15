import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

// Text stays readable on each background: the warning and success inks are
// too light for small text on their tints, so they only colour the icon.
const TONES = {
  error: { Icon: CircleAlert, box: 'bg-error-bg text-error', icon: '' },
  warning: { Icon: TriangleAlert, box: 'bg-warning-bg text-foreground', icon: 'text-warning' },
  success: { Icon: CircleCheck, box: 'bg-success-bg text-foreground', icon: 'text-success' },
} as const;

/**
 * A message with an icon (DESIGN.md: errors always carry an icon; warnings that
 * need no decision use the warning tokens, never honey).
 */
export function Callout({ tone, children }: Readonly<{ tone: keyof typeof TONES; children: React.ReactNode }>) {
  const { Icon, box, icon } = TONES[tone];
  return (
    <p role={tone === 'error' ? 'alert' : undefined} className={cn('flex items-start gap-2 rounded-lg p-3 text-sm', box)}>
      <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', icon)} />
      <span>{children}</span>
    </p>
  );
}

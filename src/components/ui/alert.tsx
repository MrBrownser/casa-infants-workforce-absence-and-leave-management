import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// Errors always carry an icon and text (crimson is close to terracotta).
// Never honey: honey means "waiting for the coordinator's decision".
const VARIANTS = {
  error: { icon: CircleAlert, tone: 'bg-error-bg text-error', role: 'alert' },
  info: { icon: Info, tone: 'bg-info-bg text-info', role: 'status' },
  success: { icon: CircleCheck, tone: 'bg-success-bg text-success', role: 'status' },
} as const;

export function Alert({
  variant = 'info',
  className,
  children,
}: Readonly<{ variant?: keyof typeof VARIANTS; className?: string; children: React.ReactNode }>) {
  const { icon: Icon, tone, role } = VARIANTS[variant];
  return (
    <div role={role} className={cn('flex items-start gap-2 rounded-lg px-3 py-2 text-sm font-medium', tone, className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

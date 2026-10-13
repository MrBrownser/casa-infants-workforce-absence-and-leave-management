'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Side sheet on desktop, bottom sheet on mobile, as in the prototypes. A plain
 * component (no dialog library, proposal: no new dependencies): Escape, the
 * close button and the backdrop all call onClose.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
}: Readonly<{ open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode }>) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div data-testid="sheet-backdrop" aria-hidden="true" className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <section
        ref={panelRef}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-2xl bg-card shadow-sheet outline-none md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[480px] md:rounded-none md:rounded-l-2xl"
      >
        <header className="flex items-start gap-3 border-b border-border px-5 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-xl">
              {title}
            </h2>
            {description && <p className="text-[0.8125rem] text-muted-foreground tabular-nums">{description}</p>}
          </div>
          <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-1" aria-label="Tanca" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </section>
    </div>
  );
}

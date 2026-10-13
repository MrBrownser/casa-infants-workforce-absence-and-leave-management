'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Side sheet on desktop, bottom sheet on mobile, as in the prototypes. A plain
 * component (no dialog library, proposal: no new dependencies): Escape, the
 * close button and the backdrop all call onClose. While open it behaves as a
 * modal: focus goes to the `[data-autofocus]` field (or the panel), Tab stays
 * inside, the page does not scroll, and focus returns to the opener on close.
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
  // Latest onClose without re-running the open effect (callers may pass a new function each render).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  function keepFocusInside(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusables = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div data-testid="sheet-backdrop" aria-hidden="true" className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <section
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={keepFocusInside}
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

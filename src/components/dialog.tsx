'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogContent, DialogDescription, Dialog as DialogRoot, DialogTitle } from '@/components/ui/dialog';

/**
 * The app's dialog for short forms (SPEC-004 design D10): centred on desktop,
 * a bottom sheet on mobile, always titled, and above an open Sheet. Base UI
 * gives the focus trap, Escape, outside press and focus return.
 * `[data-autofocus]` inside gets the initial focus, else the panel. Use `Sheet`
 * for detail panels.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: Readonly<{ open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode }>) {
  const popupRef = useRef<HTMLDivElement>(null);

  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        ref={popupRef}
        initialFocus={() => popupRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? popupRef.current}
        className="max-h-[94dvh] bg-card text-[0.9375rem] text-card-foreground shadow-sheet max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-2xl max-md:data-ending-style:translate-y-4 max-md:data-starting-style:translate-y-4 md:left-1/2 md:top-1/2 md:w-[32.5rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:data-ending-style:scale-95 md:data-starting-style:scale-95"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-border px-5 pb-4 pt-5 md:px-6">
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-xl font-semibold">{title}</DialogTitle>
            {description && <DialogDescription className="text-[0.8125rem] tabular-nums">{description}</DialogDescription>}
          </div>
          <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-1" aria-label="Tanca" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
      </DialogContent>
    </DialogRoot>
  );
}

'use client';

import { useRef, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

const DESKTOP = '(min-width: 768px)';

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(DESKTOP);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Desktop opens the sheet from the right; mobile from the bottom (DESIGN.md: no sidebar, bottom sheets). */
function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia !== 'function' || window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

/**
 * The app's panel: the shadcn Drawer (Base UI) from the right on desktop and
 * from the bottom on mobile, floating a little off the viewport edges. Base UI
 * gives the open and close animation, swipe to dismiss, focus trap, scroll
 * lock, Escape and outside press; focus returns to the opener on close.
 * `[data-autofocus]` inside the content gets the initial focus, else the panel.
 * `onClose` asks to close; `onClosed` runs after the close animation.
 */
export function Sheet({
  open,
  onClose,
  onClosed,
  title,
  description,
  children,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  onClosed?: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}>) {
  const desktop = useIsDesktop();
  const popupRef = useRef<HTMLDivElement>(null);

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      onOpenChangeComplete={(next) => {
        if (!next) onClosed?.();
      }}
      swipeDirection={desktop ? 'right' : 'down'}
    >
      <DrawerContent
        ref={popupRef}
        initialFocus={() => popupRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? popupRef.current}
        className="z-[60] bg-card text-[0.9375rem] text-card-foreground shadow-sheet [--drawer-bleed-background:transparent] [--drawer-inset:0.75rem] data-[swipe-direction=down]:rounded-2xl data-[swipe-direction=down]:border-0 data-[swipe-direction=right]:rounded-2xl data-[swipe-direction=right]:border-0 data-[swipe-axis=x]:sm:[--drawer-content-width:30rem] data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-4rem)]"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-border px-5 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <DrawerTitle className="font-display text-xl font-semibold">{title}</DrawerTitle>
            {description && <DrawerDescription className="text-[0.8125rem] tabular-nums">{description}</DrawerDescription>}
          </div>
          <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-1" aria-label="Tanca" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}

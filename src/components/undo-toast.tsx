'use client';

import { useEffect, useEffectEvent, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { unstable_rethrow } from 'next/navigation';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { SAVE_FAILED_MESSAGE } from '@/components/team/use-server-action';
import type { ActionFailure } from '@/lib/action-result';

export const TOAST_MS = 6000;

export type ToastMessage = {
  /** A new number for every message: render with `key={toast.key}` so each one starts fresh. */
  key: number;
  text: string;
  error?: boolean;
  undo?: () => Promise<{ ok: true } | ActionFailure>;
};

/** "Desfés" right after a change (docs/domain.md §10, SPEC-004 design D11). */
export function UndoToast({ toast, onDismiss }: Readonly<{ toast: ToastMessage; onDismiss: () => void }>) {
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dismiss = useEffectEvent(onDismiss);

  // A failed undo restarts the countdown so its message can be read.
  useEffect(() => {
    const timer = setTimeout(() => dismiss(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [failure]);

  const { undo } = toast;
  const isError = failure !== null || toast.error === true;

  function runUndo() {
    if (!undo) return;
    startTransition(async () => {
      try {
        const result = await undo();
        if (result.ok) onDismiss();
        else setFailure(result.message);
      } catch (error) {
        // Let redirect() (for example to /no-access) keep working.
        unstable_rethrow(error);
        console.error(error);
        setFailure(SAVE_FAILED_MESSAGE);
      }
    });
  }

  // Portalled into <body>: rendered next to an open Sheet it would sit inside
  // the content Base UI hides from screen readers (aria-hidden) while the
  // sheet is open, and "Desfés" right after deleting from the sheet would be
  // unreachable. It only mounts after a user action, so `document` exists.
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex justify-center px-4 md:bottom-8">
      <div role="status" className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-foreground px-4 py-3 text-background shadow-sheet">
        {isError ? (
          <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-error-bg" />
        ) : (
          <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-sage" />
        )}
        <p className="flex-1 text-sm">{failure ?? toast.text}</p>
        {undo && failure === null && (
          <button
            type="button"
            onClick={runUndo}
            disabled={pending}
            className="cursor-pointer text-sm font-semibold underline underline-offset-2 disabled:cursor-default disabled:opacity-60"
          >
            Desfés
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

'use client';

import { startTransition, useActionState, useState } from 'react';
import { IDLE, type ActionState, type StaffingAction } from '@/lib/action-state';

/** useActionState for a staffing Server Function, plus the preview/cancel state of two-step forms. */
export function useStaffingAction(action: StaffingAction) {
  const [state, dispatch, pending] = useActionState(action, IDLE);
  const [dismissed, setDismissed] = useState<ActionState | null>(null);
  const preview = state.status === 'preview' && state !== dismissed ? state : null;
  return {
    state,
    pending,
    preview,
    run: (input: unknown) => startTransition(() => dispatch(input)),
    cancelPreview: () => setDismissed(state),
  };
}

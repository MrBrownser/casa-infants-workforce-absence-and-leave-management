import { Alert } from '@/components/ui/alert';
import type { ActionState } from '@/lib/action-state';

export function FormStatus({ state }: Readonly<{ state: ActionState }>) {
  return state.status === 'error' ? <Alert variant="error">{state.message}</Alert> : null;
}

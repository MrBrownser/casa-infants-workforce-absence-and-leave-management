import { Alert } from '@/components/ui/alert';
import { ALREADY_APPLIED, DONE_MESSAGES, type DoneKind } from '@/lib/action-state';

export function DoneNote({ done, repeat }: Readonly<{ done: DoneKind; repeat: boolean }>) {
  return <Alert variant="success">{repeat ? ALREADY_APPLIED : DONE_MESSAGES[done]}</Alert>;
}

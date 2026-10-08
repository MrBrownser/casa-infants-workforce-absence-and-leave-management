import type { ActionState } from '@/lib/action-state';
import { ConfirmPanel } from './confirm-panel';
import { SubmitButton } from './submit-button';

/** Step one shows "Revisa els canvis"; once a preview exists it shows the confirmation panel instead. */
export function TwoStepFooter({
  preview,
  pending,
  onConfirm,
  onCancel,
}: Readonly<{
  preview: Extract<ActionState, { status: 'preview' }> | null;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  return preview ? (
    <ConfirmPanel lines={preview.lines} pending={pending} onConfirm={onConfirm} onCancel={onCancel} />
  ) : (
    <div>
      <SubmitButton pending={pending}>Revisa els canvis</SubmitButton>
    </div>
  );
}

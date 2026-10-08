import { NativeSelect } from '@/components/ui/native-select';
import { findRole } from '@/lib/roles';
import type { PositionRow } from '@/lib/staffing-views';

/** Positions of one House; occupied ones say who holds them today (the server still checks the chosen dates). */
export function PositionSelect({
  positions,
  emptyLabel = 'Sense lloc',
  ...props
}: React.ComponentProps<typeof NativeSelect> & { positions: readonly PositionRow[]; emptyLabel?: string }) {
  return (
    <NativeSelect {...props}>
      <option value="">{emptyLabel}</option>
      {positions.map((position) => (
        <option key={position.positionId} value={position.positionId}>
          {`${position.label} · ${findRole(position.roleCode)?.label ?? position.roleCode}`}
          {position.occupant ? ` (ara: ${position.occupant.fullName})` : ''}
        </option>
      ))}
    </NativeSelect>
  );
}

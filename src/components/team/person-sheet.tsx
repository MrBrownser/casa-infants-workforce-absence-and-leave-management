'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/components/sheet';
import type { IsoDate } from '@/lib/dates';
import type { HouseSlug } from '@/lib/houses';
import { describePerson, type PersonDetails, type SeatOption } from '@/lib/team';

export function PersonSheet({
  houseSlug,
  details,
}: Readonly<{ houseSlug: HouseSlug; details: PersonDetails; vacantSeats: readonly SeatOption[]; today: IsoDate }>) {
  const router = useRouter();
  const close = useCallback(() => router.push(`/${houseSlug}/team`, { scroll: false }), [router, houseSlug]);
  return (
    <Sheet open onClose={close} title={details.person.fullName} description={describePerson(details.person)}>
      {null}
    </Sheet>
  );
}

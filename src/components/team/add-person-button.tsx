'use client';

import { useCallback, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Sheet } from '@/components/sheet';
import { Button } from '@/components/ui/button';
import type { HouseSlug } from '@/lib/houses';
import { AddPersonForm } from './add-person-form';

export function AddPersonButton({ houseSlug, seat, seatName }: Readonly<{ houseSlug: HouseSlug; seat: string; seatName: string }>) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} aria-label={`Afegeix una persona a ${seatName}`}>
        <UserPlus aria-hidden="true" />
        Afegeix
      </Button>
      <Sheet open={open} onClose={close} title="Afegeix una persona" description={seatName}>
        <AddPersonForm houseSlug={houseSlug} seat={seat} onDone={close} />
      </Sheet>
    </>
  );
}

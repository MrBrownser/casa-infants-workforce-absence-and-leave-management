'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/components/sheet';
import type { IsoDate } from '@/lib/dates';
import type { HouseSlug } from '@/lib/houses';
import { describePerson, type PersonDetails, type SeatOption } from '@/lib/team';
import { BalancesSection } from './balances-section';
import { DeactivateForm } from './deactivate-form';
import { PlaceForm } from './place-form';
import { RenameForm } from './rename-form';

function SheetSection({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[0.9375rem]">{title}</h3>
      {children}
    </section>
  );
}

/** A person's details, opened from the Equip page with `?person=<id>`. */
export function PersonSheet({
  houseSlug,
  details,
  vacantSeats,
  today,
}: Readonly<{
  houseSlug: HouseSlug;
  details: PersonDetails;
  vacantSeats: readonly SeatOption[];
  today: IsoDate;
}>) {
  const router = useRouter();
  // Starts closed and opens on the next frame: Base UI only animates a drawer
  // that goes from closed to open. Closing animates first, then leaves the URL.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const { person } = details;

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      onClosed={() => router.push(`/${houseSlug}/team`, { scroll: false })}
      title={person.fullName} description={describePerson(person)}>
      <div className="flex flex-col gap-8">
        <BalancesSection houseSlug={houseSlug} details={details} currentYear={Number(today.slice(0, 4))} />
        <SheetSection title="Nom">
          <RenameForm key={person.id} houseSlug={houseSlug} personId={person.id} fullName={person.fullName} />
        </SheetSection>
        {person.active ? (
          <SheetSection title="Lloc">
            <p className="text-[0.8125rem] text-muted-foreground">
              Tria un lloc vacant d&apos;aquesta casa, de l&apos;altra o compartit. Els saldos es queden amb la persona.
            </p>
            <PlaceForm houseSlug={houseSlug} personId={person.id} vacantSeats={vacantSeats} mode="move" />
            <DeactivateForm houseSlug={houseSlug} personId={person.id} fullName={person.fullName} />
          </SheetSection>
        ) : (
          <SheetSection title="Reincorporar">
            <PlaceForm houseSlug={houseSlug} personId={person.id} vacantSeats={vacantSeats} mode="reactivate" />
          </SheetSection>
        )}
      </div>
    </Sheet>
  );
}

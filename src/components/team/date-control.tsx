import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateCa, type IsoDate } from '@/lib/dates';
import type { TeamViewName } from '@/lib/team-params';

/** A plain GET form: the selected date lives in the URL and works without JavaScript. */
export function DateControl({ view, date }: Readonly<{ view: TeamViewName; date: IsoDate }>) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-2">
      {view !== 'people' && <input type="hidden" name="view" value={view} />}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-date">Data</Label>
        <Input id="team-date" type="date" name="date" defaultValue={date} className="w-auto tabular-nums" />
      </div>
      <Button type="submit" variant="outline" className="h-11 md:h-10">
        Mostra
      </Button>
    </form>
  );
}

/** Makes a non-today date unmistakable (FR-005). Neutral info colour, not honey. */
export function DateBanner({ date, todayHref }: Readonly<{ date: IsoDate; todayHref: string }>) {
  return (
    <Alert variant="info">
      <span className="tabular-nums">Mostrant l&apos;equip del {formatDateCa(date)}.</span>{' '}
      <Link href={todayHref} className="font-semibold underline underline-offset-4">
        Torna a avui
      </Link>
    </Alert>
  );
}

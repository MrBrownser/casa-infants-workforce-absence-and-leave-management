import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const FILTERS = [
  { oweOnly: false, label: 'Tothom' },
  { oweOnly: true, label: 'Deuen hores' },
] as const;

export function SaldosToolbar({
  oweOnly,
  onOweOnlyChange,
  query,
  onQueryChange,
}: Readonly<{ oweOnly: boolean; onOweOnlyChange: (oweOnly: boolean) => void; query: string; onQueryChange: (query: string) => void }>) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <h2 id="saldos-team" className="text-xl">
        Equip
      </h2>
      <div role="group" aria-label="Filtre" className="inline-flex self-start rounded-lg border border-border bg-background p-0.5 sm:ml-4 sm:self-auto">
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            aria-pressed={oweOnly === filter.oweOnly}
            onClick={() => onOweOnlyChange(filter.oweOnly)}
            className={cn(
              'inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150 ease-out',
              oweOnly === filter.oweOnly ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <label className="relative sm:ml-auto sm:w-64">
        <span className="sr-only">Busca una persona</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Busca una persona" className="pl-9" />
      </label>
    </div>
  );
}

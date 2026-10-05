/** House name as a micro eyebrow above the Fraunces page title, so the active House is always visible. */
export function HousePageHeader({ houseName, title }: Readonly<{ houseName: string; title: string }>) {
  return (
    <header className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{houseName}</p>
      <h1 className="text-[1.875rem] tracking-[-0.015em]">{title}</h1>
    </header>
  );
}

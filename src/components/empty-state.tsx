import { HouseMark } from '@/components/house-mark';

export function EmptyState({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-12 text-center shadow-clay">
      <HouseMark className="size-24" />
      <p className="text-[0.9375rem] text-muted-foreground">{children}</p>
    </section>
  );
}

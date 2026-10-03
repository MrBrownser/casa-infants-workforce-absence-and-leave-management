import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: "Inici · Casa d'Infants",
};

export default async function DashboardPage() {
  const { name } = await requireUser();

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-3 px-8 py-16">
      <h1 className="text-[1.875rem] tracking-[-0.015em]">
        {name ? `Hola, ${name}` : 'Hola!'}
      </h1>
      <p className="max-w-xl text-[0.9375rem] leading-[1.65] text-muted-foreground">
        Encara no hi ha res. Aviat hi trobaràs la gestió de vacances i absències.
      </p>
    </main>
  );
}

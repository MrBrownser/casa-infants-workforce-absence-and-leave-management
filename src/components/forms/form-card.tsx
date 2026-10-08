import { FreshForm } from './fresh-form';

export function FormCard({ title, children }: Readonly<{ title?: string; children: React.ReactNode }>) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-clay sm:p-6">
      {title && <h2 className="text-xl">{title}</h2>}
      <FreshForm>{children}</FreshForm>
    </section>
  );
}

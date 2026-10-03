import Link from 'next/link';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { TopBar } from '@/components/top-bar';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <TopBar breadcrumb={<span className="whitespace-nowrap text-foreground">Temps i absències</span>}>
        <Show when="signed-out">
          <SignInButton>
            <Button variant="ghost" size="sm">
              Inicia la sessió
            </Button>
          </SignInButton>
          <SignUpButton>
            <Button size="sm">Crea un compte</Button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </TopBar>

      <section className="mx-auto flex max-w-[1280px] flex-col items-start gap-6 px-8 py-24">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Temps i absències
        </p>
        <h1 className="max-w-2xl text-[2.25rem] font-bold leading-[1.1] tracking-[-0.02em] text-foreground">
          Casa d&apos;Infants
        </h1>
        <p className="max-w-xl text-[0.9375rem] leading-[1.65] text-muted-foreground">
          Vacances, absències i permisos de l&apos;equip de Casa d&apos;Infants, tot en un sol lloc.
        </p>
        <div className="mt-2 flex flex-wrap gap-2.5">
          <Show when="signed-out">
            <SignInButton>
              <Button>Inicia la sessió</Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Button asChild>
              <Link href="/dashboard">Obre l&apos;aplicació</Link>
            </Button>
          </Show>
        </div>
      </section>
    </main>
  );
}

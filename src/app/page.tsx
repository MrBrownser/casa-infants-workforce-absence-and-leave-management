import Link from 'next/link';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { TopBar } from '@/components/top-bar';
import { HouseMark } from '@/components/house-mark';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <TopBar breadcrumb={<span className="whitespace-nowrap text-foreground">Temps i absències</span>}>
        <Show when="signed-out">
          <SignInButton>
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
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

      <section className="mx-auto grid max-w-[1280px] items-center gap-12 px-8 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
        <div className="flex flex-col items-start gap-6">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Temps i absències
          </p>
          <h1 className="text-[clamp(2.75rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.025em]">
            Casa d&apos;Infants
          </h1>
          <p className="max-w-xl text-[1.0625rem] leading-[1.65] text-muted-foreground">
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
        </div>
        <div className="grid aspect-square place-items-center rounded-2xl bg-sage shadow-clay">
          <HouseMark className="w-[80%]" />
        </div>
      </section>
    </main>
  );
}

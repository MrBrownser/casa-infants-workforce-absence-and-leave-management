import { UserButton } from '@clerk/nextjs';
import { TopBar } from '@/components/top-bar';
import { requireUser } from '@/lib/auth';

// Everything under the (app) route group requires a signed-in user.
// src/proxy.ts already protects these routes; requireUser() is the
// server-side check that pages and server actions rely on.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireUser();

  return (
    <div className="min-h-screen bg-background">
      <TopBar>
        <UserButton />
      </TopBar>
      {children}
    </div>
  );
}

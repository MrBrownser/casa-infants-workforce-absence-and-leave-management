import { requireUser } from '@/lib/auth';

// Everything under the (app) route group requires a signed-in user.
// src/proxy.ts already protects these routes; requireUser() is the
// server-side check. Each child (House layout, no-access page) renders its
// own top bar. Director checks live in each page and data function, because
// layouts and pages render in parallel.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireUser();

  return <div className="min-h-screen bg-background">{children}</div>;
}

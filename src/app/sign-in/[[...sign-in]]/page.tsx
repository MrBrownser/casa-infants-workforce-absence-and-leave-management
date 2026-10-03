import type { Metadata } from 'next';
import { SignIn } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: "Inicia la sessió · Casa d'Infants",
};

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <SignIn fallbackRedirectUrl="/dashboard" />
    </main>
  );
}

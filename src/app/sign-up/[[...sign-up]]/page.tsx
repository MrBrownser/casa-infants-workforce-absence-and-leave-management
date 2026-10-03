import type { Metadata } from 'next';
import { SignUp } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: "Crea un compte · Casa d'Infants",
};

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <SignUp fallbackRedirectUrl="/dashboard" />
    </main>
  );
}

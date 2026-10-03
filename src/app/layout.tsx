import type { Metadata } from 'next';
import { Figtree, Fraunces } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { caES } from '@clerk/localizations';
import { shadcn } from '@clerk/ui/themes';
import './globals.css';

// Self-hosted by next/font: no request to Google from the browser.
// Fraunces keeps its SOFT/WONK/opsz axes for the soft "clay" headings (see DESIGN.md).
const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree' });
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  variable: '--font-fraunces',
});

// Clerk's Catalan pack leaves a few strings untranslated (they fall back to
// English). Fill the gaps here as they show up.
const localization = {
  ...caES,
  formFieldInputPlaceholder__signUpPassword: 'Crea una contrasenya',
};

export const metadata: Metadata = {
  title: "Casa d'Infants",
  description: "Gestió de vacances, absències i permisos de l'equip de Casa d'Infants.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ca" className={`${figtree.variable} ${fraunces.variable}`}>
      <body>
        <ClerkProvider localization={localization} appearance={{ theme: shadcn }}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}

/* eslint-disable @next/next/no-page-custom-font -- root layout intentionally loads global fonts (Adobe Typekit + Google) per DESIGN.md */
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { caES } from '@clerk/localizations';
import './globals.css';

export const metadata: Metadata = {
  title: "Casa d'Infants",
  description: "Gestió de vacances, absències i permisos de l'equip de Casa d'Infants.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider localization={caES}>
      <html lang="ca">
        <body>
          {/*
            TODO(before launch): replace Proxima Nova. The Typekit kit `pun6hlu`
            belongs to Videocation and must not ship with this app. Pick the
            Casa d'Infants typeface via /design-consultation, then update this
            link, `--font-sans` in globals.css and DESIGN.md.
          */}
          <link
            rel="stylesheet"
            href="https://use.typekit.net/pun6hlu.css"
            precedence="default"
          />
          {/* IBM Plex Mono for data, see DESIGN.md */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap"
            precedence="default"
          />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

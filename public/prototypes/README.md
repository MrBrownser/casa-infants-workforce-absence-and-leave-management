# Prototypes

Throwaway frontend prototypes to get the director's feedback before building more of the app.
They are static HTML pages, not part of the Next.js app, and use **fictional data only**.

- The folder is self-contained (the clay-house images are copied into `assets/`), so it can be
  published on its own as a static site, or opened locally with any static server
  (`python3 -m http.server -d public/prototypes`, then `http://localhost:8000/`).
- Inside the Next.js app it is served at `/prototypes/index.html` (with the file name: Next does
  not map a folder to its `index.html`, and `src/proxy.ts` only skips `.html` URLs, so
  `/prototypes/` asks to sign in).
- To share it: deploy this folder as a separate static Vercel project (Framework preset "Other",
  Root Directory `public/prototypes`, no build command), or run `npx vercel deploy --prod`
  from this folder. No environment variables are needed.
- Look and feel follow `DESIGN.md`: tokens copied from `src/app/globals.css` into
  `shared/theme.js`, shadcn-style button and input classes.
- Libraries are vendored in `vendor/` (no CDN): Tailwind v4 browser build, Alpine.js,
  Lucide icons, Fraunces and Figtree (self-hosted, SIL OFL). Licenses in `vendor/licenses/`.
- Changes made while trying a prototype are kept only in that browser (`localStorage`).
  `saldos.html` and `mes.html` share the same data; `vacances.html` keeps its own 2027 plan.
- The rota in `mes.html` (`shared/rota.js`) is a weekly pattern by post standing in for the real
  one: weekday posts Monday to Friday, the weekend post on weekends and holidays, the two night
  educators alternating by week, and the CT covering whoever is away. Day changes and notes
  are stored per day on top of the pattern.
- Dates are shown as dd/mm/aaaa with a custom field (`dateInput` in `shared/ui.js`), because
  native date inputs follow the browser language.

| Page | Replaces in the spreadsheet | Status |
|---|---|---|
| `saldos.html` | `V I APS`: vacation days and AP hours per person | Ready |
| `vacances.html` | `VAC`: end-of-year vacation negotiation (requests, coverage conflicts, drag to adjust, lock the plan) | Ready |
| `mes.html` | Month sheets: the printable rota (who works each shift every day, who is away and who covers, uncovered shifts, day notes), plus absences, a per person table and an agenda | Ready |

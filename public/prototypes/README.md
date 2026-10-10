# Prototypes

Throwaway frontend prototypes to get the director's feedback before building more of the app.
They are static HTML pages, not part of the Next.js app, and use **fictional data only**.

- Open `index.html` (served at `/prototypes/` by Next.js or any static server, e.g.
  `python3 -m http.server -d public` then `http://localhost:8000/prototypes/`).
- `src/proxy.ts` skips `.html` files, so they need no sign-in.
- Look and feel follow `DESIGN.md`: tokens copied from `src/app/globals.css` into
  `shared/theme.js`, shadcn-style button and input classes.
- Libraries are vendored in `vendor/` (no CDN): Tailwind v4 browser build, Alpine.js,
  Lucide icons, Fraunces and Figtree (self-hosted, SIL OFL). Licenses in `vendor/licenses/`.
- Changes made while trying a prototype are kept only in that browser (`localStorage`).

| Page | Replaces in the spreadsheet | Status |
|---|---|---|
| `saldos.html` | `V I APS`: vacation days and AP hours per person | Ready |
| `vacances.html` | `VAC`: end-of-year vacation negotiation (requests, coverage conflicts, drag to adjust, lock the plan) | Ready |
| El mes | Month sheets: who is on vacation, AP or sick leave each day | Planned |

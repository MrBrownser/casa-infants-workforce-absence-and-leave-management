// Injects the Casa d'Infants design tokens (copied from src/app/globals.css, see DESIGN.md)
// as a Tailwind v4 stylesheet. Must load BEFORE vendor/tailwindcss-browser, which compiles
// every <style type="text/tailwindcss"> on the page.
document.head.insertAdjacentHTML(
  'beforeend',
  `<style type="text/tailwindcss">
@theme {
  --color-background: #F7F2EA;
  --color-card: #FFFCF7;
  --color-foreground: #2E211B;
  --color-muted-foreground: #6F625A;
  --color-primary: #A63D1F;
  --color-primary-hover: #8A3015;
  --color-primary-depth: #7A2A12;
  --color-primary-foreground: #FFFCF7;
  --color-secondary: #E6E2D0;
  --color-muted: #E6E2D0;
  --color-sage: #CCC7AA;
  --color-sage-foreground: #55583F;
  --color-hover: #EFEADC;
  --color-accent: #E9B44C;
  --color-accent-foreground: #3A2A06;
  --color-success: #5E7F5A;
  --color-success-bg: #E5EEE2;
  --color-warning: #C98A1B;
  --color-warning-fg: #8A5A0B;
  --color-warning-bg: #FBEFD3;
  --color-error: #B42328;
  --color-error-bg: #F8E1E1;
  --color-info: #2F5F6E;
  --color-info-bg: #DDEBEF;
  --color-leave-vacation: #F2D3C6;
  --color-leave-vacation-foreground: #8A3015;
  --color-leave-sick: #DDEBEF;
  --color-leave-sick-foreground: #2F5F6E;
  --color-leave-personal: #E6E2D0;
  --color-leave-personal-foreground: #55583F;
  --color-leave-training: #E9DDE8;
  --color-leave-training-foreground: #6B4A67;
  --color-border: #E7DED2;
  --color-input: #E7DED2;
  --color-ring: #A63D1F;
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.25rem;
  --shadow-clay: inset 0 1px 0 rgb(255 255 255 / 0.7), 0 1px 2px rgb(46 33 27 / 0.06), 0 8px 20px -10px rgb(46 33 27 / 0.18);
  --shadow-sheet: 0 24px 60px -20px rgb(46 33 27 / 0.35);
  --font-sans: 'Figtree Variable', ui-sans-serif, sans-serif;
  --font-display: 'Fraunces Variable', Georgia, serif;
}

@layer base {
  *, ::after, ::before { border-color: var(--color-border); }
  html { -webkit-text-size-adjust: 100%; }
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { font-weight: 600; line-height: 1.2; }
  h1, h2, .font-display {
    font-family: var(--font-display);
    font-optical-sizing: auto;
    font-variation-settings: "SOFT" 100, "WONK" 0;
  }
  [x-cloak] { display: none !important; }
  [x-icon] { display: inline-flex; }
  input[type="date"]::-webkit-calendar-picker-indicator { opacity: .6; cursor: pointer; }
}

@layer components {
  .btn {
    @apply inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold h-10 px-[18px] text-sm rounded-lg
      transition-[transform,box-shadow,background-color,color] duration-100 ease-out cursor-pointer select-none
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
      disabled:pointer-events-none disabled:opacity-50;
  }
  .btn svg { @apply size-4 shrink-0; }
  .btn-sm { @apply h-[34px] px-3.5 text-[0.8125rem] rounded-md; }
  .btn-primary {
    @apply bg-primary text-primary-foreground hover:bg-primary-hover active:translate-y-[2px] active:shadow-none;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.18), 0 2px 0 var(--color-primary-depth);
  }
  .btn-secondary {
    @apply bg-secondary text-foreground hover:bg-sage/60 active:translate-y-[2px] active:shadow-none;
    box-shadow: 0 2px 0 var(--color-sage);
  }
  .btn-outline { @apply border border-border bg-transparent text-foreground hover:bg-hover active:translate-y-px; }
  .btn-ghost { @apply text-foreground hover:bg-hover active:translate-y-px; }
  .btn-destructive { @apply border border-error/35 bg-transparent text-error hover:bg-error-bg active:translate-y-px; }
  .btn-icon { @apply size-10 px-0; }

  .card { @apply bg-card rounded-2xl border border-border shadow-clay; }
  .input {
    @apply h-10 w-full rounded-lg border border-input bg-card px-3 text-[0.9375rem] text-foreground placeholder:text-muted-foreground/70
      transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-primary;
  }
  .input[aria-invalid="true"] { @apply border-error focus-visible:ring-error/30; }
  .label { @apply block text-sm font-medium text-foreground mb-1.5; }
  .hint { @apply text-[0.8125rem] text-muted-foreground mt-1.5; }
  .eyebrow { @apply text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground; }
  .num { font-variant-numeric: tabular-nums; }

  .bar { @apply h-2 rounded-full bg-secondary overflow-hidden flex; }
  .bar > span { @apply h-full; }

  .segmented { @apply inline-flex rounded-lg bg-secondary p-1 gap-1; }
  .segmented > a, .segmented > button {
    @apply px-3 h-8 inline-flex items-center rounded-md text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground cursor-pointer;
  }
  .segmented > [aria-current="true"], .segmented > [aria-pressed="true"] { @apply bg-card text-foreground shadow-sm; }

  .choice {
    @apply relative flex gap-3 rounded-xl border border-border bg-card p-3.5 cursor-pointer transition-colors duration-150 hover:bg-hover;
  }
  .choice:has(input:checked) { @apply border-primary ring-1 ring-primary bg-card; }
  .choice input { @apply mt-1 accent-primary; }
}
</style>`
);

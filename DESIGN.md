> **Provisional.** This design system was inherited from a previous Videocation
> project and still describes that product. It is the working baseline for
> Casa d'Infants until a dedicated identity is defined via `/design-consultation`.
>
> **⚠️ TODO before launch: replace Proxima Nova.** It is loaded from Videocation's
> Adobe Typekit kit (`pun6hlu`), which is licensed to Videocation and must not ship
> with Casa d'Infants. Choose the new typeface in `/design-consultation`, then update
> the `<link>` in `src/app/layout.tsx`, `--font-sans` in `src/app/globals.css` and
> the Typography section below.

# Design System — Videocation Programs Manager

## Product Context

- **What this is:** An internal admin web app where L&D coordinators create and manage competency learning programs
- **Who it's for:** HR/L&D professionals at medium-to-large orgs — daily power users, not occasional visitors
- **Space/industry:** HR tech, LMS, competency management. Peers: 360Learning, Leapsome, WorkRamp, Docebo
- **Project type:** Web app (admin/builder tool)
- **Company:** Videocation, Norway — Nordic sensibility, quality-first

## Aesthetic Direction

- **Direction:** Nordic editorial
- **Decoration level:** Minimal — typography and whitespace do all the work
- **Mood:** Calm Monday morning, not a dashboard casino. Users open this tool and feel respected as professionals. The first viewport breathes. Every element earns its place.
- **Core principle:** Clarity over decoration. If a UI element doesn't help the user understand or act, remove it. Calm does not mean empty — it means intentional.

**Competitive positioning:** Every competitor (360Learning, Leapsome, WorkRamp) optimizes their marketing site aesthetic. This product is where the work actually happens. The design should optimize for daily habitation, not first-impression selling.

## Typography

- **Display/Hero:** Proxima Nova, weight 700, letter-spacing -0.02em — large headings only (h1, page titles)
- **Heading:** Proxima Nova, weight 700, letter-spacing -0.01em — section titles, card titles, modal headers
- **Body:** Proxima Nova, weight 400, line-height 1.65 — all reading text
- **UI/Labels:** Proxima Nova, weight 500, letter-spacing 0.01em — nav items, button labels, form labels, metadata
- **Data/Metrics:** IBM Plex Mono, weight 400/500 — counts, durations, percentages, IDs only. Never for UI chrome.
- **Loading:** Adobe Fonts via Typekit kit `pun6hlu` (shared across all Videocation apps). IBM Plex Mono via Google Fonts.

**Weight contrast is the primary design gesture.** Weight 700 headings against weight 400 body copy creates the distinctive editorial feel. No competitor in this space uses typography with this intention.

### Type Scale

| Token      | Size    | Weight | Usage                              |
|------------|---------|--------|------------------------------------|
| display    | 2.25rem | 700    | Hero headings, marketing moments   |
| h1         | 1.75rem | 700    | Page titles                        |
| h2         | 1.25rem | 700    | Section headings                   |
| h3         | 1rem    | 700    | Card titles, modal headers         |
| body       | 0.9375rem | 400  | All paragraph text                 |
| ui         | 0.8125rem | 500  | Labels, nav, buttons               |
| small      | 0.75rem | 500    | Helper text, captions              |
| micro      | 0.6875rem | 600  | Uppercase labels, tags, timestamps |
| mono       | 0.875rem | 400   | Data values (IBM Plex Mono)        |

**Blacklisted fonts:** Never use Inter, Roboto, Arial, Helvetica, Open Sans, Lato, Montserrat, or Poppins as primary type.

## Color

### Brand Layer

| Token                | Hex       | Usage                                                          |
|----------------------|-----------|----------------------------------------------------------------|
| `--color-background` | `#F7F7F7` | Page surfaces, modal backdrops                                 |
| `--color-background-mid` | `#EDEDED` | Cards, input fills, section separators                     |
| `--color-background-grey` | `#C2C2C2` | Disabled states, subtle dividers                          |
| `--color-card`       | `#FFFFFF` | Cards, popovers, elevated surfaces                             |
| `--color-primary`    | `#4D4554` | Primary buttons, dark sections, sidebar, footer                |
| `--color-accent`     | `#FFE880` | **Reserved exclusively for "needs attention" states** (see below) |
| `--color-foreground` | `#333333` | All body copy, headings, labels on light backgrounds           |
| `--color-muted-foreground` | `#C2C2C2` | Placeholder text, disabled text, hint text              |

### Semantic/Product Layer

| Token          | Hex       | Usage                                         |
|----------------|-----------|-----------------------------------------------|
| `--color-hover`     | `#F0EFF2` | Hover surface (very subtle purple tint)   |
| `--color-selected`  | `#EAE8ED` | Selected/active surface                   |
| `--color-surface-2` | `#F2F1F4` | Builder detail pane background            |
| `--color-success`   | `#6B9E7E` | Completion, published, positive states    |
| `--color-success-bg`| `#EEF5F1` | Success alert background                  |
| `--color-warning`   | `#F5A623` | Warning states, near-deadline indicators  |
| `--color-warning-bg`| `#FEF5E7` | Warning alert background                  |
| `--color-error`     | `#E53E3E` | Destructive actions, validation errors    |
| `--color-error-bg`  | `#FEF0F0` | Error alert background                    |

### Dark Mode

Invert surface hierarchy, reduce primary saturation slightly. Key dark-mode values:

| Token                | Dark value |
|----------------------|------------|
| `--color-background` | `#1A1820`  |
| `--color-card`       | `#241F2E`  |
| `--color-primary`    | `#7B72A0`  |
| `--color-hover`      | `#2A2535`  |
| `--color-selected`   | `#312C3D`  |

### The Accent Yellow Rule

`#FFE880` has **one semantic meaning only:** something requires the user's attention or decision.

- Yellow left-border on a program card → assessments awaiting review
- Yellow dot → pending approval
- Yellow pill → action-required state

Never use yellow for: general emphasis, active/in-progress states, success states, decorative highlights, or background fills for large text blocks. If you find yourself reaching for yellow for a second meaning, stop and use the semantic color layer instead.

## Status System — Texture, Not Badges

Program and module states are communicated through visual texture on the card itself, not a badge parade.

| State       | Visual treatment                                | Rationale                              |
|-------------|--------------------------------------------------|----------------------------------------|
| Published   | Clean card, full opacity, solid border           | Default — no treatment needed           |
| Draft       | Dashed border (`border-style: dashed`), `#C2C2C2` | Subtly unresolved, not yet real        |
| Archived    | `filter: saturate(0.5); opacity: 0.75`           | Fading from focus — still accessible   |
| Needs attention | Yellow left-border (3px, `#FFE880`)         | Reserved for "a decision is required"  |

Always include a status legend or tooltip for first-time users. The legend can live in an info popover on the filter/sort bar — one click, explains all four states.

## Spacing

- **Base unit:** 4px
- **Density:** Two modes

**Overview mode** (lists, dashboards, settings): generous — minimum 24px between sections, 20-24px card padding. Breathing room is the product.

**Builder mode** (step editor, module outline): compact — 8-12px internal padding inside editable elements, 4-6px between step cards. Calm does not mean spacious everywhere; daily-use builders need density.

### Scale

```
2xs:  2px    (border offsets, tight icon gaps)
xs:   4px    (inline gaps, compact row padding)
sm:   8px    (builder internal padding)
md:   16px   (standard row padding, card content gap)
lg:   24px   (card padding, between-section gap)
xl:   32px   (section margins)
2xl:  48px   (page section separation)
3xl:  64px   (hero/display breathing room)
```

## Layout

- **Approach:** Grid-disciplined for overview screens, spatial/columnar for builder context
- **Max content width:** 1280px
- **Grid:** 12 columns, 24px gutter

### Border Radius — Hierarchical

| Context                          | Token          | Value    |
|----------------------------------|----------------|----------|
| Primary buttons, cards, modals   | `rounded-xl`   | 1.25rem  |
| Builder step cards, form inputs  | `rounded-lg`   | 0.75rem  |
| Data cells, inline fields, chips | `rounded-md`   | 0.5rem   |
| Small controls, icon buttons     | `rounded-sm`   | 0.375rem |
| Avatars, status dots             | `rounded-full` | 9999px   |

Never use sharp square corners on interactive elements. Avoid applying `rounded-xl` uniformly inside dense builder contexts — it reads as toy-like at small sizes.

### Navigation — No Sidebar

Navigation is contextual: a slim top bar with the Videocation wordmark on the left, a breadcrumb in the center, and user avatar + contextual actions on the right.

```
[Videocation]  Programs › Q4 Engineering Onboarding › Module 3  [Preview] [Publish] [Avatar]
```

There are 2-3 levels of navigation depth maximum. A persistent left sidebar is overkill for this app and wastes horizontal real estate the builder needs. If navigation grows beyond 3 levels, revisit this decision.

### Program Builder — Stripe-style Columns

The builder uses progressive disclosure with spatial permanence: selecting an item reveals its detail in a panel that slides in from the right. Maximum two columns are visible simultaneously — no horizontal scrollbar.

```
[ Module list | Step detail pane ]
```

Column depth:
- `col-1` (module list): `background: var(--color-card)` — lightest, primary column
- `col-2` (step detail): `background: var(--color-surface-2)` — slightly deeper, secondary context

Breakpoints:
- `> 900px`: both columns visible
- `640–900px` (tablet): module list + detail only (list collapses to icons if needed)
- `< 640px`: single column, back-navigation

State persistence: the builder MUST remember scroll position, selected column item, and expanded sections in `localStorage`. Users close and reopen this tool mid-session. Never reset to top-of-list on page reload.

The anti-pattern to avoid: accordion hell. One section opens, another closes, the user loses their place. Accordions are for settings pages, not builders.

## Motion

- **Approach:** Minimal-functional — only transitions that aid comprehension
- **Easing:** enter: `ease-out` / exit: `ease-in` / move: `ease-in-out`
- **Duration:**
  - micro: 50–100ms (hover state fills, button presses)
  - short: 150–200ms (most UI transitions — the default)
  - medium: 250–350ms (panel slide-in, modal open)
  - long: 400–600ms (page-level transitions, if any)

Column slide-in: `transform: translateX(100%)` → `translateX(0)`, 220ms `ease-out`. The detail panel arrives — it doesn't pop.

No decorative animations that delay user action. No scroll-driven animations. No entrance animations on list items.

## Anti-Patterns

Never build these into the Programs Manager UI:

- Cluttered layouts with elements competing for attention
- Purple/violet gradients (the Leapsome trap)
- 3-column feature icon grids
- Centered everything with uniform spacing
- `rounded-xl` uniformly applied to dense builder elements
- Yellow used for anything other than "needs attention"
- Badge parade for status (use texture instead)
- Hard box shadows (use background contrast or 1px border instead)
- Animations that delay the user
- More than 3 font weights in a single screen
- Corporate language, jargon, or passive voice in UI copy

## Decisions Log

| Date       | Decision                                     | Rationale                                                                                                   |
|------------|----------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| 2026-04-17 | Initial design system created                | Created by /design-consultation. Competitive research across 360Learning, Leapsome, WorkRamp, Docebo.       |
| 2026-04-17 | Keep Proxima Nova, add IBM Plex Mono for data | Proxima Nova is established brand font. IBM Plex Mono isolated to data values only — one accent voice.      |
| 2026-04-17 | Accent yellow reserved for "needs attention" | Yellow was previously general-purpose emphasis. Reserved semantic use prevents noise at scale.               |
| 2026-04-17 | Status through texture, not badges           | Dashed/desaturated/yellow-border treatments. Badge parade degrades in dense lists. Legend added for onboarding. |
| 2026-04-17 | No sidebar navigation                        | App has 2-3 nav levels max. Contextual breadcrumb + top bar gives the builder full horizontal real estate.  |
| 2026-04-17 | Stripe-style Miller columns for builder      | Progressive disclosure without horizontal scroll. Max 2 columns visible. Tablet-responsive.                 |
| 2026-04-17 | Builder state persistence (localStorage)     | Users work mid-session and return. Resetting to top-of-list on reload is a daily tax on power users.        |
| 2026-04-17 | Semantic color layer added                   | Brand palette (primary + accent + neutrals) is insufficient for a builder UI. Success/warning/error/hover/selected tokens added. |

# Requirements backlog

Requirements received from the director (primary user) that are not yet built.
When one is picked up, drive it through `/opsx:propose` and remove it from here.

## Permits ("Permisos")

**Source:** director, 2026-10-13. **Status:** noted, not designed.

Employees sometimes need a permit (Catalan: *permís*) for a specific life event. Examples
given so far:

- Death of a relative
- Maternity / paternity
- Hospitalisation of a relative
- "etc.": the list is open-ended and the full set of permit types is still to be confirmed.

The director asked for this to be available as its own **tab** in the app (a new House-scoped
section, `[house]/permisos/`, registered in `src/components/section-nav.tsx`).

**Timing:** the functionality will be worked out later, together with the calendar and monthly
shift features. Until then, nothing is built.

**Open questions for that moment:**

- Full list of permit types and the rules for each (duration, working vs calendar days, legal basis / collective agreement).
- How permits relate to vacations and sick leave ("Baixa") in the calendar and in coverage calculations.
- Approval flow: do permits need the coordinator's decision (honey/pending) or are they registered directly?
- Privacy: some permit types reveal sensitive family or health data (GDPR Art. 9). Likely show only "Permís" in shared views, without the reason.
- Supporting documents (e.g. death certificate): are they needed, and where would they be stored?

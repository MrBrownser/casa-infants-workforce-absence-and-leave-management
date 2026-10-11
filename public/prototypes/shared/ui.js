// Shared helpers for the prototypes: Catalan dates and hours, demo persistence,
// the top bar, and an Alpine `x-icon` directive backed by Lucide.
window.PROTO = window.PROTO || {};

// ── Dates (ISO yyyy-mm-dd strings, calendar dates, no time zones) ──
const MONTHS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const MONTHS_SHORT = ['gen.', 'febr.', 'març', 'abr.', 'maig', 'juny', 'jul.', 'ag.', 'set.', 'oct.', 'nov.', 'des.'];
const WEEKDAYS_SHORT = ['dg.', 'dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.'];

PROTO.d = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
PROTO.iso = (date) => date.toISOString().slice(0, 10);
PROTO.addDays = (iso, n) => {
  const x = PROTO.d(iso);
  x.setUTCDate(x.getUTCDate() + n);
  return PROTO.iso(x);
};
PROTO.daysInclusive = (from, to) => Math.round((PROTO.d(to) - PROTO.d(from)) / 86400000) + 1;
PROTO.monthName = (m) => MONTHS[m];
PROTO.monthShort = (m) => MONTHS_SHORT[m];
PROTO.weekdayShort = (iso) => WEEKDAYS_SHORT[PROTO.d(iso).getUTCDay()];

// Dates are shown in Spanish numeric format: dd/mm/aaaa (dd/mm when the year is obvious).
const pad = (n) => String(n).padStart(2, '0');
PROTO.fmtDate = (iso) => {
  const x = PROTO.d(iso);
  return `${pad(x.getUTCDate())}/${pad(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`;
};
PROTO.fmtShort = (iso) => {
  const x = PROTO.d(iso);
  return `${pad(x.getUTCDate())}/${pad(x.getUTCMonth() + 1)}`;
};
// "02/08–22/08", or with { year: true } "02/08/2027 – 22/08/2027".
PROTO.fmtRange = (from, to, { year = false } = {}) => {
  const f = year ? PROTO.fmtDate : PROTO.fmtShort;
  if (from === to) return f(from);
  return year ? `${f(from)} – ${f(to)}` : `${f(from)}–${f(to)}`;
};
// For sentences: "del 02/08 al 22/08" or "el 02/08".
PROTO.fromTo = (from, to) => (from === to ? `el ${PROTO.fmtShort(from)}` : `del ${PROTO.fmtShort(from)} al ${PROTO.fmtShort(to)}`);
// "dd/mm/aaaa" (also d/m/aaaa) to ISO, or null when it is not a real date.
PROTO.parseDate = (raw) => {
  const m = String(raw ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return PROTO.iso(PROTO.d(iso)) === iso ? iso : null;
};

// Vacations are taken in blocks of at least one week.
PROTO.fmtWeeks = (n) => {
  const w = Math.floor(n / 7), d = n % 7;
  const ws = w === 1 ? '1 setmana' : `${w} setmanes`;
  const ds = d === 1 ? '1 dia' : `${d} dies`;
  if (!w) return ds;
  return d ? `${ws} i ${ds}` : ws;
};

// Ends a sentence with a period unless it already ends with one ("11 set.").
PROTO.sentence = (s) => (s.endsWith('.') ? s : `${s}.`);

// ── Hours ──
// 3.75 → "3 h 45 min"; signed adds "+" or "−".
PROTO.fmtHours = (h, { signed = false } = {}) => {
  const sign = h < 0 ? '−' : signed && h > 0 ? '+' : '';
  const total = Math.round(Math.abs(h) * 60);
  const hh = Math.floor(total / 60), mm = total % 60;
  let s;
  if (hh && mm) s = `${hh} h ${mm} min`;
  else if (mm) s = `${mm} min`;
  else s = `${hh} h`;
  return sign + s;
};
// Accepts "3:45", "3h45", "3,75", "3.75", "8". Returns hours or NaN.
PROTO.parseHours = (raw) => {
  const s = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return NaN;
  let m = s.match(/^(\d{1,2})(?::|h)(\d{1,2})(?:min|m)?$/);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  m = s.match(/^(\d{1,2})(?:[.,](\d{1,2}))?h?$/);
  if (m) return Number(`${m[1]}.${m[2] ?? 0}`);
  return NaN;
};

// ── Balances of one person (as of PROTO.TODAY) for the "add" forms ──
PROTO.balances = (p) => {
  const R = PROTO.RULES;
  const vacTotal = p.entitled + (p.carried || 0);
  const vacPlanned = p.v.reduce((a, e) => a + PROTO.daysInclusive(e.from, e.to), 0);
  const apnrUsed = p.apnr.reduce((a, e) => a + e.hours, 0);
  const aprUsed = p.apr.reduce((a, e) => a + e.hours, 0);
  return {
    vacTotal, vacLeft: Math.max(0, vacTotal - vacPlanned),
    apnrLeft: Math.max(0, R.apnrHours - apnrUsed), apnrDays: p.apnr.length,
    aprUsed, aprDays: p.apr.length, surplusNow: p.surplus - aprUsed,
  };
};
// Three tiles; `kinds` says which form choice each tile matters for, so it can be highlighted.
PROTO.balanceTiles = (p) => {
  const b = PROTO.balances(p), R = PROTO.RULES;
  return [
    { key: 'vac', kinds: ['vac'], label: 'Vacances', value: `${b.vacLeft} ${b.vacLeft === 1 ? 'dia' : 'dies'}`, sub: `per planificar, de ${b.vacTotal}` },
    { key: 'apnr', kinds: ['apnr'], label: 'AP no recuperables', value: PROTO.fmtHours(b.apnrLeft), sub: `queden · ${b.apnrDays}/${R.apnrMaxDays} dies` },
    { key: 'apr', kinds: ['apr'], label: 'Excedent calendari', value: PROTO.fmtHours(b.surplusNow, { signed: true }), warn: b.surplusNow < 0,
      sub: b.aprUsed ? `${PROTO.fmtHours(b.aprUsed)} d'AP rec. · ${b.aprDays}/${R.aprMaxDays}` : `AP rec.: 0/${R.aprMaxDays} dies` },
  ];
};

// ── Demo persistence: changes live only in this browser ──
const STORAGE_KEY = 'casa-infants-prototypes-v4';
let entrySeq = 0;
const nextId = () => `e${Date.now().toString(36)}${(entrySeq++).toString(36)}`;

function seedPeople() {
  const out = {};
  for (const [slug, people] of Object.entries(PROTO.PEOPLE)) {
    out[slug] = people.map((p, i) => ({
      ...p,
      color: PROTO.PERSON_COLORS[i % PROTO.PERSON_COLORS.length],
      v: p.v.map(([from, to]) => ({ id: nextId(), from, to })),
      apnr: p.apnr.map(([date, hours]) => ({ id: nextId(), date, hours })),
      apr: p.apr.map(([date, hours]) => ({ id: nextId(), date, hours })),
      baixes: (p.baixes ?? []).map(([from, to, cover]) => ({ id: nextId(), from, to, cover })),
    }));
  }
  return out;
}

PROTO.loadPeople = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* private mode or blocked storage: fall back to the sample */ }
  return seedPeople();
};
PROTO.savePeople = (all) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch (_) { /* ignore */ }
};
PROTO.resetPeople = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
};
PROTO.newId = nextId;

// ── House from the URL (?casa=carme-aymerich), defaulting to Paulo Freire ──
PROTO.currentHouse = () => {
  const slug = new URLSearchParams(location.search).get('casa');
  return PROTO.HOUSES.find((h) => h.slug === slug) ?? PROTO.HOUSES[0];
};

// ── Top bar + mobile tab bar ──
PROTO.SECTIONS = [
  { key: 'saldos', label: 'Saldos', href: 'saldos.html', icon: 'scale' },
  { key: 'vacances', label: 'Vacances 2027', href: 'vacances.html', icon: 'sun' },
  { key: 'mes', label: 'El mes', href: 'mes.html', icon: 'calendar-days' },
];

PROTO.renderShell = (active) => {
  const house = PROTO.currentHouse();
  const q = (slug) => `?casa=${slug}`;
  const nav = PROTO.SECTIONS.map((s) => {
    const current = s.key === active;
    if (!s.href) {
      return `<span class="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-muted-foreground/60 cursor-not-allowed" title="Aviat">
        ${s.label}<span class="text-[0.6875rem] font-semibold uppercase tracking-wider bg-secondary text-sage-foreground rounded-md px-1.5 py-0.5">aviat</span></span>`;
    }
    return `<a href="${s.href}${q(house.slug)}" ${current ? 'aria-current="page"' : ''}
      class="hidden md:inline-flex items-center h-9 px-3 rounded-lg text-sm font-medium transition-colors duration-150 ${current ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-hover'}">${s.label}</a>`;
  }).join('');

  const switcher = PROTO.HOUSES.map((h) => {
    const page = location.pathname.split('/').pop() || 'index.html';
    return `<a href="${page}${q(h.slug)}" ${h.slug === house.slug ? 'aria-current="true"' : ''}>${h.name}</a>`;
  }).join('');

  const top = `
  <header class="sticky top-0 z-30 bg-card/90 backdrop-blur border-b border-border">
    <div class="max-w-[1280px] mx-auto px-4 md:px-6 h-16 flex items-center gap-3 md:gap-6">
      <a href="index.html${q(house.slug)}" class="flex items-center gap-2 shrink-0">
        <img src="assets/casa-plastelina-256.webp" alt="" class="size-9 object-contain" />
        <span class="font-display text-xl font-semibold hidden sm:inline">Casa d'Infants</span>
      </a>
      <nav class="flex items-center gap-1">${nav}</nav>
      <div class="ml-auto segmented text-[0.8125rem]" aria-label="Casa">${switcher}</div>
    </div>
  </header>`;

  const tabs = PROTO.SECTIONS.map((s) => {
    const current = s.key === active;
    const base = 'flex-1 flex flex-col items-center justify-center gap-0.5 h-16 text-[0.75rem] font-medium';
    if (!s.href) return `<span class="${base} text-muted-foreground/50"><i data-icon="${s.icon}"></i>${s.label.replace(' 2027', '')}</span>`;
    return `<a href="${s.href}${q(house.slug)}" class="${base} ${current ? 'text-primary' : 'text-muted-foreground'}"><i data-icon="${s.icon}"></i>${s.label}</a>`;
  }).join('');
  const bottom = `<nav class="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border flex pb-[env(safe-area-inset-bottom)]">${tabs}</nav>`;

  document.getElementById('shell-top').outerHTML = top;
  document.getElementById('shell-bottom').outerHTML = bottom;
  PROTO.paintIcons(document);
};

// ── Icons ──
const pascal = (name) => name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
PROTO.icon = (name, cls = '') => {
  const node = window.lucide?.icons?.[pascal(name)];
  if (!node) return document.createElement('span');
  const el = window.lucide.createElement(node);
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('class', `size-4 shrink-0 ${cls}`.trim());
  return el;
};
// Static markup: <i data-icon="plus" class="..."></i>
PROTO.paintIcons = (root) => {
  root.querySelectorAll('i[data-icon]').forEach((i) => i.replaceWith(PROTO.icon(i.dataset.icon, i.className)));
};

document.addEventListener('alpine:init', () => {
  // Date field that always reads and writes dd/mm/aaaa, whatever the browser language.
  // Usage: x-data="dateInput(() => form.from, (v) => (form.from = v))". The model stays ISO.
  window.Alpine.data('dateInput', (get, set) => ({
    text: '',
    iso() { return get() || ''; },
    init() {
      this.text = get() ? PROTO.fmtDate(get()) : '';
      this.$watch(get, (v) => {
        if ((PROTO.parseDate(this.text) ?? '') !== (v || '')) this.text = v ? PROTO.fmtDate(v) : '';
      });
    },
    onInput(e) {
      let t = e.target.value;
      // Digits only: insert the slashes while typing (11082027 -> 11/08/2027).
      if (!t.includes('/')) {
        const d = t.replace(/\D/g, '').slice(0, 8);
        t = d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
        e.target.value = t;
      }
      this.text = t;
      set(PROTO.parseDate(t) ?? '');
    },
    pick(v) { if (v) { set(v); this.text = PROTO.fmtDate(v); } },
    openPicker() {
      const el = this.$refs.native;
      try { el.showPicker(); } catch (_) { el.focus(); }
    },
  }));

  // Reactive: <span x-icon="cond ? 'check' : 'x'"></span>
  window.Alpine.directive('icon', (el, { expression }, { effect, evaluateLater }) => {
    const get = evaluateLater(expression);
    // Layout comes from CSS ([x-icon] in theme.js) so x-show can still hide the element.
    effect(() => get((name) => el.replaceChildren(PROTO.icon(name, el.dataset.iconClass ?? ''))));
  });
});

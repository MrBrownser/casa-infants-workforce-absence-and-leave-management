// Who works each day in a House (prototype 3, "Quadrant").
// The rota is a simple weekly pattern by post, standing in for the director's real one:
// weekday posts Monday to Friday, the weekend post on weekends and holidays, the night
// educators alternating by week, and the CT (corretor) covering whoever is away.
// The director can change who works a given shift on a given day and add a note to the day.
window.PROTO = window.PROTO || {};

const POSTS = {
  'Educador referent': 'ER', 'Educador de nit': 'EN', 'Treballador familiar de matins': 'TFM',
  'Treballador familiar de tardes': 'TFT', 'Educador de tardes': 'ET', 'Educador de cap de setmana': 'ECS',
  Pedagoga: 'PDG', Psicòloga: 'PSI', Corretor: 'CT',
};
PROTO.postCode = (role) => POSTS[role.replace(/^Educadora\b/, 'Educador').replace(/^Treballadora\b/, 'Treballador')] ?? '';

PROTO.SHIFTS = [
  { key: 'mati', label: 'Matí', posts: ['TFM'], when: 'weekdays' },
  { key: 'tarda', label: 'Tarda', posts: ['TFT', 'ET'], when: 'weekdays' },
  { key: 'ref', label: 'Referents', posts: ['ER'], when: 'weekdays' },
  { key: 'tec', label: 'Equip tècnic', posts: ['PDG', 'PSI'], when: 'weekdays' },
  { key: 'cap', label: 'Cap de setmana i festius', posts: ['ECS'], when: 'free' },
  { key: 'nit', label: 'Nit', posts: ['EN'], when: 'nights' },
];

// Sample day notes, like the ones written in the spreadsheet ("Eva entra 21:30h").
PROTO.ROTA_NOTES = {
  'paulo-freire': { '2026-10-02': 'Ivan entra a les 21:30 h', '2026-10-17': 'Sortida a Collserola', '2026-10-30': 'Reunió d\'equip a les 15 h' },
  'carme-aymerich': { '2026-10-09': 'Joan surt a les 9 h', '2026-10-21': 'Visita de l\'EAIA' },
};

PROTO.isFreeDay = (iso) => [0, 6].includes(PROTO.d(iso).getUTCDay()) || !!PROTO.HOLIDAYS?.[iso];

// ISO week number, used to alternate the night educators.
const isoWeek = (iso) => {
  const d = PROTO.d(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
};

// People the pattern puts on a shift on a day (before absences and manual changes).
PROTO.patternFor = (people, shift, iso) => {
  const holders = people.filter((p) => shift.posts.includes(PROTO.postCode(p.role)));
  if (shift.when === 'weekdays') return PROTO.isFreeDay(iso) ? [] : holders;
  if (shift.when === 'free') return PROTO.isFreeDay(iso) ? holders : [];
  if (!holders.length) return [];
  // Nights: one educator Monday to Thursday, the other Friday to Sunday; they swap every week.
  const dow = PROTO.d(iso).getUTCDay();
  const firstHalf = dow >= 1 && dow <= 4;
  const idx = (isoWeek(iso) + (firstHalf ? 0 : 1)) % holders.length;
  return [holders[idx]];
};

// Full-day absence of a person on a day (vacation or sick leave), or an AP (partial).
PROTO.absenceOf = (p, iso) => {
  const vac = p.v.find((e) => e.from <= iso && iso <= e.to);
  if (vac) return { kind: 'vac', label: 'vac.', e: vac };
  const baixa = (p.baixes ?? []).find((e) => e.from <= iso && (!e.to || iso <= e.to));
  if (baixa) return { kind: 'baixa', label: 'baixa', e: baixa };
  return null;
};
PROTO.apOf = (p, iso) => [...p.apnr, ...p.apr].filter((e) => e.date === iso).reduce((a, e) => a + e.hours, 0);

// The day's rota: every shift with its people, who is away and who covers them.
// rotaDay = { shifts: { key: [personId] }, note } holds the director's changes for that day.
PROTO.rotaFor = (people, iso, rotaDay = {}) => {
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const ct = people.find((p) => PROTO.postCode(p.role) === 'CT') ?? null;
  const ctAway = ct ? PROTO.absenceOf(ct, iso) : null;
  let ctBusy = !ct || !!ctAway;
  let uncovered = 0;
  const shifts = PROTO.SHIFTS.map((shift) => {
    const manual = rotaDay.shifts?.[shift.key];
    const planned = manual ? manual.map((id) => byId[id]).filter(Boolean) : PROTO.patternFor(people, shift, iso);
    const slots = planned.map((p) => {
      const away = PROTO.absenceOf(p, iso);
      const ap = PROTO.apOf(p, iso);
      let cover = null;
      if (away) {
        if (away.kind === 'baixa' && away.e.cover) cover = { text: away.e.cover };
        else if (!ctBusy) { cover = { text: `${ct.name.split(' ')[0]} (CT)`, p: ct }; ctBusy = true; }
        else uncovered++;
      }
      return { p, away, ap, cover };
    });
    return { ...shift, slots, manual: !!manual };
  }).filter((s) => s.slots.length || s.manual);
  const ctCovers = shifts.flatMap((s) => s.slots).find((x) => x.cover?.p === ct);
  return {
    shifts,
    uncovered,
    note: rotaDay.note ?? '',
    ct: ct && { p: ct, away: ctAway, covering: ctCovers ? ctCovers.p : null },
  };
};

// Demo persistence of the director's changes to the rota.
const ROTA_KEY = 'casa-infants-rota-v1';
PROTO.loadRota = () => {
  try { const raw = localStorage.getItem(ROTA_KEY); if (raw) return JSON.parse(raw); } catch (_) { /* fall back */ }
  const out = {};
  for (const [slug, notes] of Object.entries(PROTO.ROTA_NOTES)) {
    out[slug] = Object.fromEntries(Object.entries(notes).map(([iso, note]) => [iso, { note }]));
  }
  return out;
};
PROTO.saveRota = (rota) => { try { localStorage.setItem(ROTA_KEY, JSON.stringify(rota)); } catch (_) { /* ignore */ } };
PROTO.resetRota = () => { try { localStorage.removeItem(ROTA_KEY); } catch (_) { /* ignore */ } };

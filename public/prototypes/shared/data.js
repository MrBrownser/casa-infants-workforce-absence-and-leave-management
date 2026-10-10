// Fictional sample data for the prototypes. Every name is invented; none comes from
// the real spreadsheet. "Today" is fixed so the prototypes always tell the same story.
window.PROTO = window.PROTO || {};

PROTO.TODAY = '2026-10-10';
PROTO.YEAR = 2026;

// Rules as understood from the current spreadsheet (to be confirmed with the director).
PROTO.RULES = {
  vacationDays: 31,      // natural days per year, prorated when someone joins mid-year
  apnrHours: 24,         // AP no recuperables: 24 h per year...
  apnrMaxDays: 5,        // ...in at most 5 requests
  aprHours: 24,          // AP recuperables: 24 h per year...
  aprMaxDays: 3,         // ...in at most 3 requests, deducted from the calendar surplus
};

PROTO.HOUSES = [
  { slug: 'paulo-freire', name: 'Paulo Freire' },
  { slug: 'carme-aymerich', name: 'Carme Aymerich' },
];

PROTO.PERSON_COLORS = [
  '#C2703D', '#5E95A6', '#8C8A63', '#8E6A8A', '#4F8A7B', '#C47A86',
  '#6A7B9C', '#8A6A4F', '#6E8B4E', '#D08B6B', '#7A6FA8', '#A89268',
];

// v = vacation periods [from, to] (inclusive natural days)
// apnr / apr = [date, hours]
// surplus = "hores excedent calendari" before any APR is deducted (+ ahead, - owes)
PROTO.PEOPLE = {
  'paulo-freire': [
    { id: 'pf1', name: 'Laia Puig', role: 'Educadora referent', entitled: 31, carried: 0, surplus: 14.5,
      v: [['2026-08-03', '2026-08-23'], ['2026-12-21', '2026-12-30']],
      apnr: [['2026-02-20', 4], ['2026-05-15', 8]], apr: [['2026-03-12', 3.75]] },
    { id: 'pf2', name: 'Jordi Serra', role: 'Educador de nit', entitled: 31, carried: 10, surplus: 55.5,
      v: [['2026-01-04', '2026-01-13'], ['2026-07-13', '2026-07-26'], ['2026-11-09', '2026-11-18']],
      apnr: [['2026-04-06', 11], ['2026-04-07', 2], ['2026-07-31', 2]], apr: [['2026-06-19', 9.75]] },
    { id: 'pf3', name: 'Núria Casals', role: 'Treballadora familiar de matins', entitled: 31, carried: 0, surplus: 3.25,
      v: [['2026-07-27', '2026-08-26']],
      apnr: [['2026-09-25', 8], ['2026-12-07', 8]], apr: [] },
    { id: 'pf4', name: 'Marc Vidal', role: 'Educador de cap de setmana', entitled: 16, carried: 0, surplus: -2,
      joined: '2026-07-01',
      v: [['2026-09-14', '2026-09-27']],
      apnr: [], apr: [['2026-09-29', 6.5]] },
    { id: 'pf5', name: 'Rosa Ferrer', role: 'Psicòloga', entitled: 31, carried: 0, surplus: 31.5,
      v: [['2026-04-20', '2026-04-26'], ['2026-08-24', '2026-09-06'], ['2026-12-14', '2026-12-23']],
      apnr: [['2026-01-29', 8.5], ['2026-03-25', 8.5], ['2026-04-08', 7]], apr: [['2026-04-08', 1.5]] },
    { id: 'pf6', name: 'Pau Roca', role: 'Educador de tardes', entitled: 31, carried: 0, surplus: 1.7,
      v: [['2026-05-01', '2026-05-10'], ['2026-07-13', '2026-07-26']],
      apnr: [['2026-03-13', 2]], apr: [['2026-03-18', 11]] },
    { id: 'pf7', name: 'Carmen Ortiz', role: 'Educadora referent', entitled: 31, carried: 0, surplus: 19.25,
      v: [['2026-05-30', '2026-06-08'], ['2026-07-04', '2026-07-17'], ['2026-11-21', '2026-11-27']],
      apnr: [['2026-02-08', 12.5]], apr: [] },
    { id: 'pf8', name: 'Ivan Molina', role: 'Educador de nit', entitled: 31, carried: 0, surplus: -4,
      v: [['2026-04-19', '2026-04-25'], ['2026-05-16', '2026-05-22'], ['2026-08-08', '2026-08-17'], ['2026-10-31', '2026-11-06']],
      apnr: [['2026-03-18', 11], ['2026-03-19', 11]], apr: [] },
    { id: 'pf9', name: 'Montse Soler', role: 'Pedagoga', entitled: 31, carried: 0, surplus: 36.3,
      v: [['2026-07-13', '2026-07-19'], ['2026-08-03', '2026-08-16']],
      apnr: [['2026-01-05', 1.5], ['2026-04-01', 8.5]], apr: [] },
    { id: 'pf10', name: 'Sílvia Prat', role: 'Treballadora familiar de tardes', entitled: 31, carried: 0, surplus: 25,
      v: [['2026-06-29', '2026-07-05'], ['2026-09-14', '2026-09-23'], ['2026-12-07', '2026-12-20']],
      apnr: [['2026-06-26', 5]], apr: [] },
    { id: 'pf11', name: 'Òscar Gil', role: 'Corretor', entitled: 31, carried: 0, surplus: 12,
      v: [['2026-06-22', '2026-07-05']],
      apnr: [['2026-01-23', 8]], apr: [] },
  ],
  'carme-aymerich': [
    { id: 'ca1', name: 'Aina Costa', role: 'Educadora referent', entitled: 31, carried: 0, surplus: 22,
      v: [['2026-07-06', '2026-07-26'], ['2026-12-23', '2026-12-31'], ['2026-02-16', '2026-02-16']],
      apnr: [['2026-03-02', 8], ['2026-06-12', 6]], apr: [] },
    { id: 'ca2', name: 'Joan Pons', role: 'Educador de nit', entitled: 31, carried: 5, surplus: 41,
      v: [['2026-01-02', '2026-01-06'], ['2026-08-10', '2026-08-30']],
      apnr: [['2026-05-04', 11], ['2026-09-21', 11]], apr: [['2026-10-02', 8]] },
    { id: 'ca3', name: 'Mireia Font', role: 'Treballadora familiar de matins', entitled: 31, carried: 0, surplus: 6.5,
      v: [['2026-08-03', '2026-08-23'], ['2026-10-26', '2026-11-04']],
      apnr: [['2026-01-19', 4]], apr: [['2026-04-17', 5], ['2026-09-11', 4.5]] },
    { id: 'ca4', name: 'Lucía Romero', role: 'Psicòloga', entitled: 31, carried: 0, surplus: 28,
      v: [['2026-07-27', '2026-08-16'], ['2026-12-21', '2026-12-30']],
      apnr: [['2026-02-27', 8.5], ['2026-11-13', 8.5]], apr: [] },
    { id: 'ca5', name: 'Xavi Martí', role: 'Educador de tardes', entitled: 31, carried: 0, surplus: -6.25,
      v: [['2026-06-15', '2026-06-28']],
      apnr: [['2026-03-27', 7]], apr: [['2026-05-22', 6]] },
    { id: 'ca6', name: 'Clara Sala', role: 'Educadora de cap de setmana', entitled: 31, carried: 3, surplus: 10,
      v: [['2026-04-04', '2026-04-12'], ['2026-08-17', '2026-08-30'], ['2026-12-05', '2026-12-15']],
      apnr: [['2026-01-10', 12], ['2026-06-06', 12]], apr: [] },
    { id: 'ca7', name: 'David Navarro', role: 'Educador de nit', entitled: 31, carried: 0, surplus: 17.75,
      v: [['2026-05-18', '2026-05-31'], ['2026-09-07', '2026-09-20']],
      apnr: [['2026-02-02', 11]], apr: [] },
    { id: 'ca8', name: 'Noemí Castro', role: 'Pedagoga', entitled: 31, carried: 0, surplus: 33,
      v: [['2026-07-20', '2026-08-09'], ['2026-12-28', '2026-12-31']],
      apnr: [['2026-04-10', 8], ['2026-10-23', 8]], apr: [] },
    { id: 'ca9', name: 'Raúl Iglesias', role: 'Corretor', entitled: 23, carried: 0, surplus: 4,
      joined: '2026-03-16',
      v: [['2026-08-31', '2026-09-13']],
      apnr: [], apr: [['2026-06-30', 3]] },
    { id: 'ca10', name: 'Teresa Mas', role: 'Treballadora familiar de tardes', entitled: 31, carried: 0, surplus: 15.5,
      v: [['2026-03-30', '2026-04-05'], ['2026-07-06', '2026-07-19'], ['2026-11-30', '2026-12-09']],
      apnr: [['2026-05-08', 5], ['2026-09-18', 5]], apr: [] },
  ],
};

// ── Vacation plan for next year (prototype 2) ──
// Requests collected at the end of 2026. aa = days carried over from 2026 ("any anterior").
// Each request: [from, to, state] with state 'p' = requested (waiting for a decision), 'a' = accepted.
PROTO.PLAN_YEAR = 2027;
PROTO.PLAN = {
  'paulo-freire': {
    maxOff: 2,
    people: {
      pf1: { aa: 0, r: [['2027-08-02', '2027-08-22', 'p'], ['2027-12-20', '2027-12-29', 'p']] },
      pf2: { aa: 7, r: [['2027-01-11', '2027-01-17', 'a'], ['2027-07-12', '2027-07-25', 'p'], ['2027-10-18', '2027-10-31', 'p'], ['2027-12-27', '2027-12-29', 'p']] },
      pf3: { aa: 0, r: [['2027-07-26', '2027-08-25', 'p']] },
      pf4: { aa: 2, r: [['2027-03-29', '2027-04-04', 'a'], ['2027-09-13', '2027-09-26', 'p'], ['2027-11-29', '2027-12-08', 'p']] },
      pf5: { aa: 0, r: [['2027-04-19', '2027-04-25', 'a'], ['2027-08-23', '2027-09-05', 'p'], ['2027-12-20', '2027-12-29', 'p']] },
      pf6: { aa: 7, r: [['2027-05-03', '2027-05-09', 'p'], ['2027-07-05', '2027-07-25', 'p']] },
      pf7: { aa: 0, r: [['2027-06-07', '2027-06-13', 'a'], ['2027-08-09', '2027-08-22', 'p'], ['2027-11-15', '2027-11-24', 'p']] },
      pf8: { aa: 0, r: [['2027-04-26', '2027-05-02', 'a'], ['2027-07-15', '2027-07-28', 'p'], ['2027-11-01', '2027-11-10', 'p']] },
      pf9: { aa: 10, r: [['2027-06-28', '2027-07-11', 'p'], ['2027-08-30', '2027-09-12', 'p'], ['2027-12-30', '2027-12-31', 'p']] },
      pf10: { aa: 0, r: [['2027-06-21', '2027-06-27', 'a'], ['2027-09-13', '2027-09-22', 'p'], ['2027-12-13', '2027-12-26', 'p']] },
      pf11: { aa: 0, r: [['2027-06-14', '2027-06-27', 'p'], ['2027-10-04', '2027-10-20', 'p']] },
    },
  },
  'carme-aymerich': {
    maxOff: 2,
    people: {
      ca1: { aa: 0, r: [['2027-07-05', '2027-07-25', 'p'], ['2027-12-22', '2027-12-31', 'p']] },
      ca2: { aa: 3, r: [['2027-01-04', '2027-01-08', 'a'], ['2027-08-09', '2027-08-29', 'p'], ['2027-11-08', '2027-11-15', 'p']] },
      ca3: { aa: 0, r: [['2027-08-02', '2027-08-22', 'p'], ['2027-10-25', '2027-11-03', 'p']] },
      ca4: { aa: 0, r: [['2027-07-26', '2027-08-15', 'p'], ['2027-12-20', '2027-12-29', 'p']] },
      ca5: { aa: 0, r: [['2027-06-14', '2027-06-27', 'a'], ['2027-09-06', '2027-09-19', 'p']] },
      ca6: { aa: 4, r: [['2027-04-03', '2027-04-11', 'a'], ['2027-08-16', '2027-08-29', 'p'], ['2027-12-04', '2027-12-14', 'p']] },
      ca7: { aa: 0, r: [['2027-05-17', '2027-05-30', 'a'], ['2027-08-23', '2027-09-05', 'p'], ['2027-10-11', '2027-10-13', 'p']] },
      ca8: { aa: 0, r: [['2027-03-22', '2027-03-26', 'a'], ['2027-07-19', '2027-08-08', 'p'], ['2027-12-27', '2027-12-31', 'p']] },
      ca9: { aa: 0, r: [['2027-02-15', '2027-02-17', 'a'], ['2027-08-30', '2027-09-12', 'p'], ['2027-11-22', '2027-12-05', 'p']] },
      ca10: { aa: 0, r: [['2027-03-29', '2027-04-04', 'a'], ['2027-07-05', '2027-07-18', 'p'], ['2027-11-29', '2027-12-08', 'p']] },
    },
  },
};

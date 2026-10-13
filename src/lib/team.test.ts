import { describe, expect, it } from 'vitest';
import { nightSeatOnDuty } from './posts';
import { belongsTo, buildTeamView, describePerson, seatLabel, vacantSeats, type PersonRecord } from './team';

let n = 0;
const person = (fullName: string, house: PersonRecord['house'], postKey: string, extra: Partial<PersonRecord> = {}): PersonRecord => ({
  id: `p${++n}`,
  fullName,
  house,
  postKey,
  seat: 1,
  startedOn: '2025-09-01',
  active: true,
  ...extra,
});

const TODAY = '2026-10-13';
const people: PersonRecord[] = [
  person('Meritxell Torres Vila', null, 'pdg'),
  person('Clara Soler Pujol', null, 'pdg', { active: false }),
  person('Carla Ribas Solé', 'paulo-freire', 'er'),
  person('David Valls Medina', 'paulo-freire', 'en', { seat: 1 }),
  person('Cristina Pascual Duran', 'paulo-freire', 'en', { seat: 2 }),
  person('Pol Jiménez Alcover', 'paulo-freire', 'ct', { active: false }),
  person('Laia Vidal Mas', 'carme-aymerich', 'er'),
  person('Àlex García Martí', 'carme-aymerich', 'ct', { active: false }),
  person('Persona Perduda', 'paulo-freire', 'old-post'),
];

describe('buildTeamView', () => {
  const view = buildTeamView('paulo-freire', people, TODAY);

  it('lists the shared posts with their people', () => {
    expect(view.shared.map((p) => [p.label, p.seats.map((s) => s.person?.fullName ?? 'Vacant')])).toEqual([
      ['Pedagoga', ['Meritxell Torres Vila']],
      ['Psicòloga', ['Vacant']],
    ]);
  });

  it('lists every House post in inventory order, vacant seats included', () => {
    expect(view.posts.map((p) => p.key)).toEqual(['er', 'tfm', 'tft', 'et', 'ecs', 'en', 'ct']);
    const ct = view.posts.find((p) => p.key === 'ct')!;
    expect(ct.summary).toBe('Sense horari fix');
    expect(ct.seats[0].person).toBeNull();
    expect(ct.seats[0].encoded).toBe('paulo-freire:ct:1');
  });

  it('shows both night people and which one works this week', () => {
    const en = view.posts.find((p) => p.key === 'en')!;
    expect(en.alternates).toBe(true);
    expect(en.seats.map((s) => s.person?.fullName)).toEqual(['David Valls Medina', 'Cristina Pascual Duran']);
    expect(en.seats.map((s) => s.onDutyThisWeek)).toEqual([nightSeatOnDuty(TODAY) === 1, nightSeatOnDuty(TODAY) === 2]);
    expect(view.posts.find((p) => p.key === 'er')!.seats[0].onDutyThisWeek).toBeNull();
  });

  it('never shows people of the other House', () => {
    const names = JSON.stringify(view);
    expect(names).not.toContain('Laia Vidal Mas');
    expect(names).not.toContain('Àlex García Martí');
  });

  it('lists inactive people of the House and of the shared posts as former members', () => {
    expect(view.former.map((p) => p.fullName)).toEqual(['Clara Soler Pujol', 'Pol Jiménez Alcover']);
  });

  it('keeps an active person whose post no longer exists visible', () => {
    expect(view.unplaced.map((p) => p.fullName)).toEqual(['Persona Perduda']);
  });
});

describe('vacantSeats', () => {
  it('offers every free seat of both Houses and the shared posts', () => {
    const options = vacantSeats(people);
    const values = options.map((o) => o.value);
    expect(values).toContain('shared:psi:1');
    expect(values).toContain('carme-aymerich:ct:1');
    expect(values).toContain('paulo-freire:ct:1');
    expect(values).not.toContain('shared:pdg:1');
    expect(values).not.toContain('paulo-freire:en:2');
    expect(options.find((o) => o.value === 'carme-aymerich:ct:1')?.label).toBe('Carme Aymerich · Corretorn');
  });
});

describe('labels', () => {
  it('names seats with their House and number when the post has two', () => {
    expect(seatLabel({ house: 'paulo-freire', postKey: 'en', seat: 2 })).toBe('Paulo Freire · Educadora de nit 2');
    expect(seatLabel({ house: null, postKey: 'pdg', seat: 1 })).toBe('Compartit · Pedagoga');
  });

  it('describes a person for the details sheet', () => {
    expect(describePerson(people[2])).toBe('Paulo Freire · Educadora referent · des del 01/09/2025');
    expect(describePerson(people[5])).toBe('Paulo Freire · Corretorn · des del 01/09/2025 · antic membre');
  });

  it('says a shared person belongs to both Houses', () => {
    expect(belongsTo(people[0], 'carme-aymerich')).toBe(true);
    expect(belongsTo(people[6], 'paulo-freire')).toBe(false);
  });
});

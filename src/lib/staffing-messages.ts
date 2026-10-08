// Catalan copy for staffing errors and plan previews. Messages never name the
// conflicting person: the store's error type carries no personal data.
import { formatDateCa } from './dates';
import type { StaffingPlan } from './staffing';
import type { StaffingErrorReason } from './staffing-error';

const MESSAGES: Record<StaffingErrorReason, string> = {
  'invalid-dates': "La data de final no pot ser anterior a la d'inici.",
  'not-ongoing': 'Aquest període ja té data de final.',
  'same-house': "La casa de destinació ha de ser diferent de l'actual.",
  'starts-too-early': "La data del trasllat ha de ser posterior a l'inici de la pertinença actual.",
  'membership-overlap': "Aquestes dates se solapen amb un altre període d'aquesta persona.",
  'employee-has-position': 'Aquesta persona ja té un lloc assignat en aquestes dates.',
  'position-occupied': 'Aquest lloc ja està ocupat en aquestes dates.',
  'outside-membership': "El lloc ha de quedar dins d'un període de pertinença a aquesta casa.",
  'future-assignment-blocks': "Hi ha una assignació futura que hi entra en conflicte. No s'ha canviat res.",
  'label-taken': 'Ja hi ha un lloc amb aquest nom en aquesta casa.',
  stale: 'Les dades han canviat mentrestant. Torna a carregar la pàgina.',
  'not-found': 'No hem trobat aquest registre en aquesta casa.',
  'operation-conflict': "Aquest formulari ja s'ha fet servir per a una altra acció. Torna a carregar la pàgina.",
};

export const INVALID_FORM = 'Revisa les dades del formulari.';
export const UNEXPECTED_ERROR = "No s'ha pogut desar. Torna-ho a provar d'aquí a una estona.";

export function errorMessage(reason: StaffingErrorReason): string {
  return MESSAGES[reason];
}

export type PlanNames = {
  employees: Record<string, string>;
  positions: Record<string, string>;
  houses: Record<string, string>;
};

type PlanItem = { kind: 'assignment' | 'membership'; employeeId: string; houseId: string; positionId?: string | null };

/** One Catalan line per change, closes first, for the confirmation screen. */
export function describePlan(plan: StaffingPlan, names: PlanNames): string[] {
  const subject = (item: PlanItem) => {
    const house = names.houses[item.houseId] ?? '';
    return item.kind === 'assignment' && item.positionId
      ? `lloc ${names.positions[item.positionId] ?? ''} a ${house}`
      : `pertinença a ${house}`;
  };
  const who = (item: PlanItem) => names.employees[item.employeeId] ?? '';
  return [
    ...plan.closes.map((close) => `${who(close)}: ${subject(close)} acaba el ${formatDateCa(close.endsOn)}.`),
    ...plan.opens.map(
      (open) =>
        `${who(open)}: ${subject(open)} comença el ${formatDateCa(open.startsOn)}` +
        (open.endsOn ? ` i acaba el ${formatDateCa(open.endsOn)}.` : '.'),
    ),
  ];
}

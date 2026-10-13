// The people of the Equip page as plain data, shared by the server and the
// client components.
import type { IsoDate } from './dates';
import type { HouseSlug } from './houses';

export type PersonRecord = {
  id: string;
  fullName: string;
  /** null for a shared post (PDG, PSI). */
  house: HouseSlug | null;
  postKey: string;
  seat: number;
  startedOn: IsoDate | null;
  active: boolean;
};

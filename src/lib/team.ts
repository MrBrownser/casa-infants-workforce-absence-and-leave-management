// The people of the Equip page as plain data, shared by the server and the
// client components.
import { formatDateDdMmYyyy, type IsoDate } from './dates';
import { findHouseBySlug, type HouseSlug } from './houses';
import {
  ROLE_LABELS,
  allSeats,
  encodeSeatRef,
  findPost,
  isValidSeat,
  nightSeatOnDuty,
  postsOf,
  scheduleSummary,
  sharedPosts,
  type Post,
  type RoleCode,
  type SeatRef,
} from './posts';
import type { OpeningBalances } from './rules';

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

export type SeatView = {
  ref: SeatRef;
  /** The seat as a form value, see encodeSeatRef. */
  encoded: string;
  person: PersonRecord | null;
  /** For posts with two alternating seats: does this seat work this week? null otherwise. */
  onDutyThisWeek: boolean | null;
};

export type PostView = {
  key: string;
  roleCode: RoleCode;
  label: string;
  summary: string;
  alternates: boolean;
  seats: SeatView[];
};

export type TeamView = {
  shared: PostView[];
  posts: PostView[];
  /** Active people whose seat is not in the code inventory any more: shown so the director can move them. */
  unplaced: PersonRecord[];
  /** "Antics membres": inactive people of the House or of a shared post. */
  former: PersonRecord[];
};

export type SeatOption = { value: string; label: string };

export type PersonDetails = { person: PersonRecord; year: number; balances: OpeningBalances; stored: boolean };

/** A shared person belongs to both Houses. */
export function belongsTo(person: PersonRecord, house: HouseSlug): boolean {
  return person.house === house || person.house === null;
}

const byName = (a: PersonRecord, b: PersonRecord) => a.fullName.localeCompare(b.fullName, 'ca');

export function buildTeamView(house: HouseSlug, people: readonly PersonRecord[], today: IsoDate): TeamView {
  const visible = people.filter((p) => belongsTo(p, house));
  const active = visible.filter((p) => p.active);
  const nightSeat = nightSeatOnDuty(today);

  const postView = (owner: HouseSlug | null, post: Post): PostView => ({
    key: post.key,
    roleCode: post.roleCode,
    label: ROLE_LABELS[post.roleCode],
    summary: scheduleSummary(post.schedule),
    alternates: post.seats > 1,
    seats: Array.from({ length: post.seats }, (_, i) => {
      const ref: SeatRef = { house: owner, postKey: post.key, seat: i + 1 };
      return {
        ref,
        encoded: encodeSeatRef(ref),
        person: active.find((p) => p.house === owner && p.postKey === post.key && p.seat === ref.seat) ?? null,
        onDutyThisWeek: post.seats > 1 ? nightSeat === ref.seat : null,
      };
    }),
  });

  return {
    shared: sharedPosts().map((post) => postView(null, post)),
    posts: postsOf(house).map((post) => postView(house, post)),
    unplaced: active.filter((p) => !isValidSeat(p)).sort(byName),
    former: visible.filter((p) => !p.active).sort(byName),
  };
}

export function seatLabel(ref: SeatRef): string {
  const post = findPost(ref.house, ref.postKey);
  const role = post ? ROLE_LABELS[post.roleCode] : ref.postKey;
  const number = post && post.seats > 1 ? ` ${ref.seat}` : '';
  const where = ref.house ? (findHouseBySlug(ref.house)?.name ?? ref.house) : 'Compartit';
  return `${where} · ${role}${number}`;
}

/** Every seat with no active person, across both Houses and the shared posts. */
export function vacantSeats(people: readonly PersonRecord[]): SeatOption[] {
  const taken = new Set(people.filter((p) => p.active).map((p) => encodeSeatRef(p)));
  return allSeats()
    .filter((ref) => !taken.has(encodeSeatRef(ref)))
    .map((ref) => ({ value: encodeSeatRef(ref), label: seatLabel(ref) }));
}

export function describePerson(person: PersonRecord): string {
  return [
    seatLabel(person),
    person.startedOn ? `des del ${formatDateDdMmYyyy(person.startedOn)}` : null,
    person.active ? null : 'antic membre',
  ]
    .filter(Boolean)
    .join(' · ');
}

import { firstParam, type SearchParams } from './action-state';
import { isIsoDate, type IsoDate } from './dates';

export const TEAM_VIEWS = ['people', 'positions', 'former'] as const;
export type TeamViewName = (typeof TEAM_VIEWS)[number];

function isTeamView(value: string | undefined): value is TeamViewName {
  return TEAM_VIEWS.some((view) => view === value);
}

/** `?view=` and `?date=` of the Equip page; anything invalid falls back to people today. */
export function parseTeamSearchParams(params: SearchParams, today: IsoDate): { view: TeamViewName; date: IsoDate } {
  const view = firstParam(params, 'view');
  const date = firstParam(params, 'date');
  return { view: isTeamView(view) ? view : 'people', date: date && isIsoDate(date) ? date : today };
}

/** Former members have no date, so the date is dropped for that view. */
export function teamHref(slug: string, view: TeamViewName, date: IsoDate, today: IsoDate): string {
  const query = new URLSearchParams();
  if (view !== 'people') query.set('view', view);
  if (view !== 'former' && date !== today) query.set('date', date);
  const search = query.toString();
  return `/${slug}/team${search ? `?${search}` : ''}`;
}

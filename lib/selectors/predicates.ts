import { isActiveCycle, type Cycle } from "@/lib/schemas/cycle";
import type { Episode } from "@/lib/schemas/episode";
import type { Order } from "@/lib/schemas/orders";
import type { Person } from "@/lib/schemas/person";
import type { WaitingEntry } from "@/lib/schemas/admin";
import type { DateRange } from "@/lib/selectors/types";
import { isWithin } from "@/lib/utils/dates";

/** Branch filter: "all" or empty means every branch. */
export function inBranch(item: { branchId: string }, branchId: string | undefined): boolean {
  return !branchId || branchId === "all" || item.branchId === branchId;
}

export function inRange(iso: string | undefined, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  return isWithin(iso, range.from, range.to);
}

export const isPatient = (p: Person): boolean => p.roles.includes("patient");

export const isClosedEpisode = (e: Episode, range: DateRange = {}): boolean =>
  e.status === "closed" && inRange(e.closedAt, range);

export const isCancelledDrug = (o: Order, range: DateRange = {}): boolean =>
  o.kind === "pharmacy" && o.status === "cancelled" && inRange(o.at, range);

export const isTodayPosting = (w: WaitingEntry, today: string): boolean => w.date === today;

/** Active cycle = not completed/cancelled and its episode is not closed. */
export function isActiveTreatmentCycle(c: Cycle, episodesById: ReadonlyMap<string, Episode>): boolean {
  const ep = episodesById.get(c.episodeId);
  return Boolean(ep && ep.status !== "closed" && isActiveCycle(c));
}

/** Latest cycle per episode (highest number). */
export function currentCycleFor(episodeId: string, cycles: readonly Cycle[]): Cycle | undefined {
  return cycles.filter((c) => c.episodeId === episodeId).sort((a, b) => b.number - a.number)[0];
}

/** Episode shown for a patient: the open one if any, otherwise the most recent. */
export function primaryEpisodeFor(personId: string, episodes: readonly Episode[]): Episode | undefined {
  const mine = episodes.filter((e) => e.patientId === personId);
  return mine.find((e) => e.status !== "closed") ?? [...mine].sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0];
}

import { TZDate } from "@date-fns/tz";
import { addDays as addDaysFns, differenceInCalendarDays, differenceInMinutes, format, parseISO } from "date-fns";
import { APP_CONFIG } from "@/lib/config";

const TZ = APP_CONFIG.timezone;

/** Current instant as an ISO date-time string (UTC). */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Today's calendar date in Lagos as YYYY-MM-DD. */
export function todayIso(anchor: Date = new Date()): string {
  return format(new TZDate(anchor, TZ), "yyyy-MM-dd");
}

/** Shift a YYYY-MM-DD date by n days. */
export function shiftDate(iso: string, days: number): string {
  return format(addDaysFns(parseISO(iso), days), "yyyy-MM-dd");
}

/** Build an ISO date-time for a Lagos local date and HH:mm time. */
export function lagosDateTime(isoDate: string, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const local = new TZDate(`${isoDate}T00:00:00`, TZ);
  local.setHours(h ?? 0, m ?? 0, 0, 0);
  return new Date(local.getTime()).toISOString();
}

export function formatDate(value: string | undefined | null): string {
  if (!value) return "—";
  const d = value.length === 10 ? parseISO(value) : new TZDate(new Date(value), TZ);
  return format(d, "dd/MM/yyyy");
}

export function formatDateTime(value: string | undefined | null): string {
  if (!value) return "—";
  return format(new TZDate(new Date(value), TZ), "dd/MM/yyyy HH:mm");
}

export function formatTime(value: string | undefined | null): string {
  if (!value) return "—";
  return format(new TZDate(new Date(value), TZ), "HH:mm");
}

export function monthKey(value: string): string {
  return value.slice(0, 7);
}

export function monthLabel(key: string): string {
  return format(parseISO(`${key}-01`), "MMM yy");
}

/** Last n month keys (YYYY-MM) ending with the month of `anchorIso`. */
export function lastMonths(anchorIso: string, n: number): string[] {
  const base = parseISO(`${anchorIso.slice(0, 7)}-01`);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    keys.push(format(d, "yyyy-MM"));
  }
  return keys;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return differenceInCalendarDays(parseISO(toIso.slice(0, 10)), parseISO(fromIso.slice(0, 10)));
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return differenceInMinutes(new Date(toIso), new Date(fromIso));
}

export interface AgeParts {
  years: number;
  months: number;
  days: number;
}

export function ageParts(dob: string, onIso: string = todayIso()): AgeParts {
  const birth = parseISO(dob);
  const on = parseISO(onIso);
  let years = on.getFullYear() - birth.getFullYear();
  let months = on.getMonth() - birth.getMonth();
  let days = on.getDate() - birth.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(on.getFullYear(), on.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

export function ageYears(dob: string, onIso?: string): number {
  return ageParts(dob, onIso).years;
}

export function formatAge(dob: string, long = false): string {
  const a = ageParts(dob);
  return long ? `${a.years}y ${a.months}m ${a.days}d` : `${a.years}y`;
}

export function isWithin(iso: string | undefined, from?: string, to?: string): boolean {
  if (!iso) return false;
  const d = iso.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

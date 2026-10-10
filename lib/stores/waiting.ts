import { waitingEntrySchema, type WaitingEntry, type WaitingStatus } from "@/lib/schemas/admin";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { assert, createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { formatTime, nowIso, todayIso } from "@/lib/utils/dates";
import { newId } from "@/lib/utils/ids";

export interface AddToWaitingInput {
  personId: string;
  episodeId?: string;
  doctorId: string;
  purpose: string;
  branchId: string;
}

const TRANSITIONS: Record<WaitingStatus, WaitingStatus[]> = {
  waiting: ["called", "no-show"],
  called: ["in-consultation", "waiting", "no-show"],
  "in-consultation": ["completed"],
  completed: [],
  "no-show": ["waiting"],
};

export function allowedTransitions(status: WaitingStatus): WaitingStatus[] {
  return TRANSITIONS[status];
}

export interface WaitingState {
  entries: WaitingEntry[];
  add: (input: AddToWaitingInput) => WaitingEntry;
  setStatus: (id: string, status: WaitingStatus) => WaitingEntry;
  reset: (seed: SeedData) => void;
}

export const useWaitingStore = createDomainStore<WaitingState>("waiting", (set, get) => ({
  entries: [],
  add: (input) => {
    const today = todayIso();
    const active = get().entries.find(
      (e) => e.personId === input.personId && e.date === today && e.status !== "completed" && e.status !== "no-show",
    );
    assert(!active, "This patient is already on today's waiting list");
    assert(input.purpose.trim().length >= 3, "Enter the purpose of the visit", "purpose");
    const now = nowIso();
    const entry = validate(waitingEntrySchema, {
      ...input,
      id: newId("WL"),
      date: today,
      time: formatTime(now),
      arrivedAt: now,
      status: "waiting",
    });
    set((s) => {
      s.entries.push(entry);
    });
    audit("create", "waiting-list", `Added patient to waiting list (${entry.purpose})`, input.personId);
    return entry;
  },
  setStatus: (id, status) => {
    const current = get().entries.find((e) => e.id === id);
    if (!current) throw new DomainError("Waiting list entry not found");
    assert(TRANSITIONS[current.status].includes(status), `Cannot move from ${current.status} to ${status}`);
    const now = nowIso();
    const next = validate(waitingEntrySchema, {
      ...current,
      status,
      calledAt: status === "called" ? now : status === "waiting" ? undefined : current.calledAt,
      seenAt: status === "in-consultation" ? now : current.seenAt,
      completedAt: status === "completed" ? now : current.completedAt,
    });
    set((s) => {
      s.entries[s.entries.findIndex((e) => e.id === id)] = next;
    });
    audit("update", "waiting-list", `Waiting status → ${status}`, current.personId);
    return next;
  },
  reset: (seed) =>
    set((s) => {
      s.entries = seed.waiting;
    }),
}));

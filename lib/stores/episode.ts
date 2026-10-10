import {
  closeEpisodeSchema,
  episodeSchema,
  type CloseEpisodeInput,
  type Episode,
  type EpisodeType,
} from "@/lib/schemas/episode";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { assert, createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { useRequestStore } from "@/lib/stores/requests";
import { todayIso } from "@/lib/utils/dates";
import { newId, nextSequence } from "@/lib/utils/ids";

export interface OpenEpisodeInput {
  patientId: string;
  partnerId?: string;
  type: EpisodeType;
  doctorId: string;
  diagnosis: string[];
  branchId: string;
}

export interface EpisodeState {
  episodes: Episode[];
  open: (input: OpenEpisodeInput, ivfPrefix?: string) => Episode;
  update: (id: string, patch: Partial<Pick<Episode, "doctorId" | "diagnosis" | "type" | "status">>) => Episode;
  close: (id: string, input: CloseEpisodeInput) => Episode;
  reopen: (id: string) => Episode;
  reset: (seed: SeedData) => void;
}

export const useEpisodeStore = createDomainStore<EpisodeState>("episodes", (set, get) => ({
  episodes: [],
  open: (input, ivfPrefix = "IVF-2026") => {
    const existing = get().episodes.find((e) => e.patientId === input.patientId && e.status !== "closed");
    assert(!existing, `An open episode already exists (${existing?.ivfNo ?? ""}). Close it before opening a new one.`);
    const episode = validate(episodeSchema, {
      ...input,
      id: newId("EP"),
      ivfNo: nextSequence(
        get().episodes.map((e) => e.ivfNo),
        `${ivfPrefix}-`,
        4,
      ),
      status: "open",
      openedAt: todayIso(),
    });
    set((s) => {
      s.episodes.push(episode);
    });
    audit("create", "episode", `Opened ${episode.type} episode ${episode.ivfNo}`, episode.id);
    return episode;
  },
  update: (id, patch) => {
    const current = get().episodes.find((e) => e.id === id);
    if (!current) throw new DomainError("Episode not found");
    assert(
      current.status !== "closed" || patch.status === undefined,
      "Closed files can only be reopened with manager approval",
    );
    const next = validate(episodeSchema, { ...current, ...patch });
    set((s) => {
      s.episodes[s.episodes.findIndex((e) => e.id === id)] = next;
    });
    audit("update", "episode", `Updated episode ${next.ivfNo}`, id);
    return next;
  },
  close: (id, input) => {
    const current = get().episodes.find((e) => e.id === id);
    if (!current) throw new DomainError("Episode not found");
    assert(current.status !== "closed", "This file is already closed");
    const parsed = validate(closeEpisodeSchema, input);
    const next = validate(episodeSchema, { ...current, ...parsed, status: "closed", closedAt: todayIso() });
    set((s) => {
      s.episodes[s.episodes.findIndex((e) => e.id === id)] = next;
    });
    audit("update", "episode", `Closed file ${next.ivfNo} — ${parsed.closeReason}`, id);
    return next;
  },
  reopen: (id) => {
    const current = get().episodes.find((e) => e.id === id);
    if (!current) throw new DomainError("Episode not found");
    assert(current.status === "closed", "Only closed files can be reopened");
    const approval = useRequestStore
      .getState()
      .requests.find(
        (r) =>
          r.kind === "file-reopen" &&
          r.entityId === id &&
          r.status === "approved" &&
          r.decidedAt &&
          (!current.closedAt || r.decidedAt.slice(0, 10) >= current.closedAt),
      );
    if (!approval)
      throw new DomainError("Reopening a closed file needs manager approval. Submit a reopen request first.");
    const next = validate(episodeSchema, {
      ...current,
      status: "open",
      closedAt: undefined,
      closeReason: undefined,
      closeNote: undefined,
    });
    set((s) => {
      s.episodes[s.episodes.findIndex((e) => e.id === id)] = next;
    });
    audit("update", "episode", `Reopened file ${next.ivfNo} (approval ${approval.id})`, id);
    return next;
  },
  reset: (seed) =>
    set((s) => {
      s.episodes = seed.episodes;
    }),
}));

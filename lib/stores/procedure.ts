import { procedureSchema, ProcedureType, type Procedure } from "@/lib/schemas/procedure";
import { addendumSchema } from "@/lib/schemas/procedure";
import { getSeed, seedSlice } from "@/lib/seed/build";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { assert, createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { currentActorId } from "@/lib/stores/session";
import { nowIso } from "@/lib/utils/dates";
import { newId } from "@/lib/utils/ids";

export type ProcedureDraftInput = Omit<Procedure, "id" | "status" | "signatureDataUrl" | "signedAt" | "addenda">;

export const PROCEDURE_LOCKED_MESSAGE = "This procedure note has been posted and is locked. Add an addendum instead.";

export interface ProcedureState {
  procedures: Procedure[];
  saveDraft: (input: ProcedureDraftInput, id?: string) => Procedure;
  post: (id: string, signatureDataUrl: string) => Procedure;
  addAddendum: (id: string, body: string) => Procedure;
  discardDraft: (id: string) => void;
  reset: (seed?: SeedData) => void;
}

export const useProcedureStore = createDomainStore<ProcedureState>("procedures", (set, get) => ({
  procedures: seedSlice("procedures"),
  saveDraft: (input, id) => {
    validate(ProcedureType, input.type);
    const existing = id ? get().procedures.find((p) => p.id === id) : undefined;
    if (id && !existing) throw new DomainError("Procedure not found");
    if (existing) assert(existing.status === "draft", PROCEDURE_LOCKED_MESSAGE);
    const proc = validate(procedureSchema, {
      ...input,
      id: existing?.id ?? newId("PR"),
      status: "draft",
      addenda: existing?.addenda ?? [],
    });
    set((s) => {
      const idx = s.procedures.findIndex((p) => p.id === proc.id);
      if (idx >= 0) s.procedures[idx] = proc;
      else s.procedures.push(proc);
    });
    audit(existing ? "update" : "create", "procedure", `Saved ${proc.type} draft`, proc.cycleId);
    return proc;
  },
  post: (id, signatureDataUrl) => {
    const current = get().procedures.find((p) => p.id === id);
    if (!current) throw new DomainError("Procedure not found");
    assert(current.status === "draft", PROCEDURE_LOCKED_MESSAGE);
    assert(signatureDataUrl.startsWith("data:image"), "Sign the note before posting", "signatureDataUrl");
    const posted = validate(procedureSchema, { ...current, status: "posted", signatureDataUrl, signedAt: nowIso() });
    set((s) => {
      s.procedures[s.procedures.findIndex((p) => p.id === id)] = posted;
    });
    audit("post", "procedure", `Signed and posted ${posted.type} note`, posted.cycleId);
    return posted;
  },
  addAddendum: (id, body) => {
    const current = get().procedures.find((p) => p.id === id);
    if (!current) throw new DomainError("Procedure not found");
    assert(current.status === "posted", "Drafts can be edited directly; addenda are for posted notes");
    const addendum = validate(addendumSchema, {
      id: newId("ADD"),
      body: body.trim(),
      authorId: currentActorId(),
      at: nowIso(),
    });
    set((s) => {
      s.procedures.find((p) => p.id === id)?.addenda.push(addendum);
    });
    audit("update", "procedure", `Added addendum to ${current.type} note`, current.cycleId);
    return { ...current, addenda: [...current.addenda, addendum] };
  },
  discardDraft: (id) => {
    const current = get().procedures.find((p) => p.id === id);
    if (!current) throw new DomainError("Procedure not found");
    assert(current.status === "draft", PROCEDURE_LOCKED_MESSAGE);
    set((s) => {
      s.procedures = s.procedures.filter((p) => p.id !== id);
    });
    audit("cancel", "procedure", `Discarded ${current.type} draft`, current.cycleId);
  },
  reset: (seed = getSeed()) =>
    set((s) => {
      s.procedures = seed.procedures;
    }),
}));

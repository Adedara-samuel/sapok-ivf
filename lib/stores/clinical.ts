import { z } from "zod";
import { documentSchema, type PatientDocument } from "@/lib/schemas/admin";
import {
  medicalHistorySchema,
  noteSchema,
  stimulationEntrySchema,
  vitalsSchema,
  type MedicalHistory,
  type Note,
  type NoteKind,
  type StimulationEntry,
  type Vitals,
} from "@/lib/schemas/clinical";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { assert, createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { currentActorId } from "@/lib/stores/session";
import { nowIso } from "@/lib/utils/dates";
import { newId } from "@/lib/utils/ids";

export type StimulationInput = Omit<StimulationEntry, "id" | "cycleId" | "postedBy">;
export type VitalsInput = Omit<Vitals, "id" | "episodeId" | "postedBy" | "at">;
export type HistoryInput = Omit<MedicalHistory, "id" | "personId" | "updatedAt" | "updatedBy">;

export const documentInputSchema = z.object({
  name: z.string().min(1, "Choose a file"),
  category: documentSchema.shape.category,
  sizeKb: z.number().nonnegative(),
  mime: z.string(),
  dataUrl: z.string().optional(),
});
export type DocumentInput = z.infer<typeof documentInputSchema>;

export interface ClinicalState {
  notes: Note[];
  stimulation: StimulationEntry[];
  vitals: Vitals[];
  histories: MedicalHistory[];
  documents: PatientDocument[];
  addNote: (episodeId: string, kind: NoteKind, body: string) => Note;
  addAddendum: (noteId: string, body: string) => Note;
  addStimulation: (cycleId: string, input: StimulationInput) => StimulationEntry;
  addVitals: (episodeId: string, input: VitalsInput) => Vitals;
  saveHistory: (personId: string, input: HistoryInput) => MedicalHistory;
  addDocument: (episodeId: string, input: DocumentInput) => PatientDocument;
  removeDocument: (id: string) => void;
  reset: (seed: SeedData) => void;
}

export const useClinicalStore = createDomainStore<ClinicalState>("clinical", (set, get) => ({
  notes: [],
  stimulation: [],
  vitals: [],
  histories: [],
  documents: [],
  addNote: (episodeId, kind, body) => {
    const note = validate(noteSchema, {
      id: newId("NT"),
      episodeId,
      kind,
      body: body.trim(),
      authorId: currentActorId(),
      createdAt: nowIso(),
    });
    set((s) => {
      s.notes.push(note);
    });
    audit("create", "note", `Added ${kind} note`, episodeId);
    return note;
  },
  addAddendum: (noteId, body) => {
    const original = get().notes.find((n) => n.id === noteId);
    if (!original) throw new DomainError("Note not found");
    const note = validate(noteSchema, {
      id: newId("NT"),
      episodeId: original.episodeId,
      kind: original.kind,
      body: body.trim(),
      authorId: currentActorId(),
      createdAt: nowIso(),
      addendumOf: original.addendumOf ?? original.id,
    });
    set((s) => {
      s.notes.push(note);
    });
    audit("create", "note", "Added addendum to a posted note", original.episodeId);
    return note;
  },
  addStimulation: (cycleId, input) => {
    const entry = validate(stimulationEntrySchema, { ...input, id: newId("ST"), cycleId, postedBy: currentActorId() });
    assert(
      !get().stimulation.some((s) => s.cycleId === cycleId && s.date === entry.date && s.scanDay === entry.scanDay),
      "An entry for this scan day and date already exists",
      "scanDay",
    );
    set((s) => {
      s.stimulation.push(entry);
    });
    audit("create", "stimulation", `Posted ${entry.scanDay} monitoring entry`, cycleId);
    return entry;
  },
  addVitals: (episodeId, input) => {
    const v = validate(vitalsSchema, {
      ...input,
      id: newId("VT"),
      episodeId,
      postedBy: currentActorId(),
      at: nowIso(),
    });
    assert(v.bpDia < v.bpSys, "Diastolic must be lower than systolic", "bpDia");
    set((s) => {
      s.vitals.push(v);
    });
    audit("create", "vitals", `Recorded ${v.phase} vitals`, episodeId);
    return v;
  },
  saveHistory: (personId, input) => {
    const existing = get().histories.find((h) => h.personId === personId);
    const h = validate(medicalHistorySchema, {
      ...input,
      id: existing?.id ?? newId("MH"),
      personId,
      updatedAt: nowIso(),
      updatedBy: currentActorId(),
    });
    set((s) => {
      const idx = s.histories.findIndex((x) => x.personId === personId);
      if (idx >= 0) s.histories[idx] = h;
      else s.histories.push(h);
    });
    audit("update", "history", "Updated medical history", personId);
    return h;
  },
  addDocument: (episodeId, input) => {
    const parsed = validate(documentInputSchema, input);
    assert(parsed.sizeKb <= 3 * 1024, "Files must be 3 MB or smaller in the demo", "name");
    const doc = validate(documentSchema, {
      ...parsed,
      id: newId("DOC"),
      episodeId,
      uploadedAt: nowIso(),
      uploadedBy: currentActorId(),
    });
    set((s) => {
      s.documents.push(doc);
    });
    audit("create", "document", `Uploaded document ${doc.name}`, episodeId);
    return doc;
  },
  removeDocument: (id) => {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc) throw new DomainError("Document not found");
    set((s) => {
      s.documents = s.documents.filter((d) => d.id !== id);
    });
    audit("cancel", "document", `Removed document ${doc.name}`, doc.episodeId);
  },
  reset: (seed) =>
    set((s) => {
      s.notes = seed.notes;
      s.stimulation = seed.stimulation;
      s.vitals = seed.vitals;
      s.histories = seed.histories;
      s.documents = seed.documents;
    }),
}));

import { z } from "zod";
import { isoDate } from "@/lib/schemas/common";
import { CycleOutcome, CycleProtocol, CycleStage, cycleSchema, type Cycle } from "@/lib/schemas/cycle";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { assert, createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { newId } from "@/lib/utils/ids";

export const newCycleSchema = z.object({
  kind: z.enum(["fresh", "frozen"]),
  protocol: CycleProtocol,
  startDate: isoDate,
  lmp: isoDate.optional(),
  amh: z.number().nonnegative().optional(),
  afc: z.number().int().nonnegative().optional(),
});
export type NewCycleInput = z.infer<typeof newCycleSchema>;

export const triggerSchema = z.object({
  date: isoDate,
  drug: z.string().min(2, "Choose the trigger drug"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm"),
});
export const ocrSummarySchema = z
  .object({
    eggs: z.number().int().nonnegative(),
    mii: z.number().int().nonnegative(),
    fertilised: z.number().int().nonnegative(),
  })
  .refine((o) => o.mii <= o.eggs, { message: "MII cannot exceed eggs retrieved", path: ["mii"] })
  .refine((o) => o.fertilised <= o.mii, { message: "Fertilised cannot exceed MII oocytes", path: ["fertilised"] });
export const transferPlanSchema = z.object({
  date: isoDate,
  embryoIds: z.array(z.string()).min(1, "Select at least one embryo").max(3, "No more than 3 embryos"),
});
export const outcomeSchema = z.object({
  outcome: CycleOutcome,
  betaValue: z.number().nonnegative().optional(),
  betaDate: isoDate.optional(),
});

const ACTIVE_LIMIT_MESSAGE = "This cycle is closed. Start a new cycle instead.";

export interface CycleState {
  cycles: Cycle[];
  create: (episodeId: string, input: NewCycleInput) => Cycle;
  setStage: (id: string, stage: Cycle["stage"]) => void;
  setTrigger: (id: string, input: z.infer<typeof triggerSchema>) => void;
  setOcr: (id: string, input: z.infer<typeof ocrSummarySchema>) => void;
  setTransferPlan: (id: string, input: z.infer<typeof transferPlanSchema>) => void;
  setLuteal: (id: string, text: string) => void;
  setPlan: (id: string, text: string) => void;
  recordOutcome: (id: string, input: z.infer<typeof outcomeSchema>) => void;
  cancel: (id: string, reason: string) => void;
  reset: (seed: SeedData) => void;
}

export const useCycleStore = createDomainStore<CycleState>("cycles", (set, get) => {
  const mutate = (id: string, summary: string, fn: (c: Cycle) => void): Cycle => {
    const current = get().cycles.find((c) => c.id === id);
    if (!current) throw new DomainError("Cycle not found");
    const draft = structuredClone(current);
    fn(draft);
    const next = validate(cycleSchema, draft);
    set((s) => {
      s.cycles[s.cycles.findIndex((c) => c.id === id)] = next;
    });
    audit("update", "cycle", summary, id);
    return next;
  };
  const ensureOpen = (id: string): Cycle => {
    const c = get().cycles.find((x) => x.id === id);
    if (!c) throw new DomainError("Cycle not found");
    assert(c.stage !== "completed" && c.stage !== "cancelled", ACTIVE_LIMIT_MESSAGE);
    return c;
  };
  return {
    cycles: [],
    create: (episodeId, input) => {
      const parsed = validate(newCycleSchema, input);
      const existing = get().cycles.filter((c) => c.episodeId === episodeId);
      assert(
        !existing.some((c) => c.stage !== "completed" && c.stage !== "cancelled"),
        "Finish or cancel the current cycle before starting a new one",
      );
      const cycle = validate(cycleSchema, {
        ...parsed,
        id: newId("CY"),
        episodeId,
        number: existing.length + 1,
        stage: "baseline",
        outcome: "pending",
      });
      set((s) => {
        s.cycles.push(cycle);
      });
      audit("create", "cycle", `Started cycle ${cycle.number} (${cycle.kind}, ${cycle.protocol})`, cycle.id);
      return cycle;
    },
    setStage: (id, stage) => {
      validate(CycleStage, stage);
      ensureOpen(id);
      mutate(id, `Moved cycle to stage ${stage}`, (c) => {
        c.stage = stage;
      });
    },
    setTrigger: (id, input) => {
      ensureOpen(id);
      const trigger = validate(triggerSchema, input);
      mutate(id, `Planned trigger ${trigger.drug} on ${trigger.date} ${trigger.time}`, (c) => {
        c.trigger = trigger;
        if (c.stage === "stimulation" || c.stage === "baseline" || c.stage === "downreg") c.stage = "trigger";
      });
    },
    setOcr: (id, input) => {
      ensureOpen(id);
      const ocr = validate(ocrSummarySchema, input);
      mutate(id, `Recorded OCR summary: ${ocr.eggs} eggs, ${ocr.mii} MII, ${ocr.fertilised} fertilised`, (c) => {
        c.ocr = ocr;
        if (["baseline", "downreg", "stimulation", "trigger", "ocr"].includes(c.stage)) c.stage = "culture";
      });
    },
    setTransferPlan: (id, input) => {
      ensureOpen(id);
      const plan = validate(transferPlanSchema, input);
      mutate(id, `Planned transfer of ${plan.embryoIds.length} embryo(s) on ${plan.date}`, (c) => {
        c.transferPlan = plan;
        if (c.stage !== "luteal" && c.stage !== "pregnancy-test") c.stage = "transfer";
      });
    },
    setLuteal: (id, text) => {
      ensureOpen(id);
      assert(text.trim().length >= 3, "Describe the luteal support regimen", "lutealSupport");
      mutate(id, "Updated luteal support", (c) => {
        c.lutealSupport = text.trim();
      });
    },
    setPlan: (id, text) => {
      assert(text.trim().length >= 3, "Write a short plan", "plan");
      mutate(id, "Updated cycle plan", (c) => {
        c.plan = text.trim();
      });
    },
    recordOutcome: (id, input) => {
      const parsed = validate(outcomeSchema, input);
      assert(parsed.outcome !== "pending", "Choose an outcome", "outcome");
      mutate(id, `Recorded cycle outcome: ${parsed.outcome}`, (c) => {
        c.outcome = parsed.outcome;
        if (parsed.betaDate || parsed.betaValue !== undefined)
          c.betaHcg = { date: parsed.betaDate ?? c.betaHcg?.date ?? c.startDate, value: parsed.betaValue };
        c.stage = parsed.outcome === "cancelled" ? "cancelled" : "completed";
      });
    },
    cancel: (id, reason) => {
      ensureOpen(id);
      assert(reason.trim().length >= 5, "Give a reason for cancelling (at least 5 characters)", "reason");
      mutate(id, `Cancelled cycle: ${reason.trim()}`, (c) => {
        c.stage = "cancelled";
        c.outcome = "cancelled";
        c.cancelReason = reason.trim();
      });
    },
    reset: (seed) =>
      set((s) => {
        s.cycles = seed.cycles;
      }),
  };
});

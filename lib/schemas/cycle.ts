import { z } from "zod";
import { id, isoDate } from "@/lib/schemas/common";

export const CycleKind = z.enum(["fresh", "frozen"]);
export const CycleStage = z.enum([
  "baseline",
  "downreg",
  "stimulation",
  "trigger",
  "ocr",
  "fertilisation",
  "culture",
  "transfer",
  "luteal",
  "pregnancy-test",
  "completed",
  "cancelled",
]);
export type CycleStage = z.infer<typeof CycleStage>;

export const CycleProtocol = z.enum(["antagonist", "long-agonist", "mild", "natural", "fet-hrt", "fet-natural"]);
export type CycleProtocol = z.infer<typeof CycleProtocol>;

export const CycleOutcome = z.enum([
  "pending",
  "biochemical",
  "clinical-pregnancy",
  "ongoing",
  "live-birth",
  "miscarriage",
  "negative",
  "cancelled",
]);
export type CycleOutcome = z.infer<typeof CycleOutcome>;

export const cycleSchema = z.object({
  id,
  episodeId: id,
  number: z.number().int().positive(),
  kind: CycleKind,
  protocol: CycleProtocol,
  stage: CycleStage,
  lmp: isoDate.optional(),
  startDate: isoDate,
  outcome: CycleOutcome,
  amh: z.number().optional(),
  afc: z.number().int().optional(),
  trigger: z.object({ date: isoDate, drug: z.string(), time: z.string() }).optional(),
  ocr: z
    .object({
      eggs: z.number().int().nonnegative(),
      mii: z.number().int().nonnegative(),
      fertilised: z.number().int().nonnegative(),
    })
    .optional(),
  transferPlan: z.object({ date: isoDate, embryoIds: z.array(id) }).optional(),
  lutealSupport: z.string().optional(),
  betaHcg: z.object({ date: isoDate, value: z.number().nonnegative().optional() }).optional(),
  plan: z.string().optional(),
  cancelReason: z.string().optional(),
});
export type Cycle = z.infer<typeof cycleSchema>;

export const STAGE_ORDER: readonly CycleStage[] = [
  "baseline",
  "downreg",
  "stimulation",
  "trigger",
  "ocr",
  "fertilisation",
  "culture",
  "transfer",
  "luteal",
  "pregnancy-test",
  "completed",
];

export const FROZEN_STAGE_ORDER: readonly CycleStage[] = [
  "baseline",
  "stimulation",
  "transfer",
  "luteal",
  "pregnancy-test",
  "completed",
];

export function isActiveCycle(c: Pick<Cycle, "stage">): boolean {
  return c.stage !== "completed" && c.stage !== "cancelled";
}

export const PREGNANT_OUTCOMES: readonly CycleOutcome[] = [
  "clinical-pregnancy",
  "ongoing",
  "live-birth",
  "miscarriage",
];

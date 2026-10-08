import { z } from "zod";
import { id, isoDate } from "@/lib/schemas/common";

const test3 = z.enum(["negative", "positive", "pending"]);

export const historyEntrySchema = z.object({ at: isoDate, label: z.string() });

export const donorSchema = z.object({
  id,
  personId: id,
  kind: z.enum(["oocyte", "sperm"]),
  code: z.string(),
  age: z.number().int().min(18).max(45),
  bloodGroup: z.string(),
  height: z.number(),
  eyeColour: z.string(),
  hairColour: z.string(),
  complexion: z.string(),
  screening: z.object({
    hiv: test3,
    hepB: test3,
    hepC: test3,
    syphilis: test3,
    karyotype: z.enum(["normal", "abnormal", "pending"]),
    geneticPanel: z.enum(["clear", "carrier", "pending"]),
  }),
  status: z.enum(["screening", "available", "matched", "in-cycle", "retired"]),
  matchedEpisodeId: id.optional(),
  amh: z.number().optional(),
  history: z.array(historyEntrySchema),
});
export type Donor = z.infer<typeof donorSchema>;

export const surrogateSchema = z.object({
  id,
  personId: id,
  code: z.string(),
  age: z.number().int().min(21).max(40),
  parity: z.number().int(),
  screening: z.object({
    medical: z.enum(["cleared", "pending", "failed"]),
    psychological: z.enum(["cleared", "pending", "failed"]),
    uterineEval: z.enum(["normal", "abnormal", "pending"]),
    legal: z.enum(["signed", "pending"]),
  }),
  status: z.enum(["screening", "approved", "matched", "pregnant", "delivered", "retired"]),
  matchedEpisodeId: id.optional(),
  legalSignedAt: isoDate.optional(),
  history: z.array(historyEntrySchema),
});
export type Surrogate = z.infer<typeof surrogateSchema>;

export type ScreeningVerdict = "eligible" | "pending" | "ineligible";

export function donorEligibility(d: Pick<Donor, "screening">): ScreeningVerdict {
  const s = d.screening;
  const values = [s.hiv, s.hepB, s.hepC, s.syphilis, s.karyotype, s.geneticPanel];
  if (s.hiv === "positive" || s.hepB === "positive" || s.hepC === "positive" || s.syphilis === "positive")
    return "ineligible";
  if (s.karyotype === "abnormal" || s.geneticPanel === "carrier") return "ineligible";
  if (values.includes("pending")) return "pending";
  return "eligible";
}

export function surrogateEligibility(s: Pick<Surrogate, "screening">): ScreeningVerdict {
  const v = s.screening;
  if (v.medical === "failed" || v.psychological === "failed" || v.uterineEval === "abnormal") return "ineligible";
  if (v.medical === "pending" || v.psychological === "pending" || v.uterineEval === "pending" || v.legal === "pending")
    return "pending";
  return "eligible";
}

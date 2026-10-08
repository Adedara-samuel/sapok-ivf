import { z } from "zod";
import { id, isoDate, isoDateTime } from "@/lib/schemas/common";

export const NoteKind = z.enum(["doctor", "nurse", "counselling"]);
export type NoteKind = z.infer<typeof NoteKind>;

export const noteSchema = z.object({
  id,
  episodeId: id,
  kind: NoteKind,
  body: z.string().min(3, "Write at least 3 characters"),
  authorId: id,
  createdAt: isoDateTime,
  addendumOf: id.optional(),
});
export type Note = z.infer<typeof noteSchema>;

export const follicleList = z.array(z.number().positive().max(40));

export const stimulationEntrySchema = z.object({
  id,
  cycleId: id,
  date: isoDate,
  scanDay: z.string().min(1, "Enter the scan day, e.g. D8 follicular scan"),
  injections: z.array(z.object({ drug: z.string().min(1), dose: z.string().min(1) })),
  endometriumMm: z.number().positive().max(30).optional(),
  follicles: z.object({ right: follicleList, left: follicleList }),
  e2: z.number().nonnegative().optional(),
  lh: z.number().nonnegative().optional(),
  progesterone: z.number().nonnegative().optional(),
  remark: z.string().optional(),
  nextScan: isoDate.optional(),
  postedBy: id,
});
export type StimulationEntry = z.infer<typeof stimulationEntrySchema>;

export const vitalsSchema = z.object({
  id,
  episodeId: id,
  phase: z.enum(["pre-op", "post-op", "routine"]),
  at: isoDateTime,
  pulse: z.number().min(30).max(220),
  resp: z.number().min(6).max(60),
  bpSys: z.number().min(60).max(260),
  bpDia: z.number().min(30).max(160),
  tempC: z.number().min(34).max(42),
  spo2: z.number().min(70).max(100),
  postedBy: id,
});
export type Vitals = z.infer<typeof vitalsSchema>;

export const VITAL_RANGES = {
  pulse: { min: 60, max: 100, label: "Pulse", unit: "bpm" },
  resp: { min: 12, max: 20, label: "Resp. rate", unit: "/min" },
  bpSys: { min: 90, max: 139, label: "Systolic BP", unit: "mmHg" },
  bpDia: { min: 60, max: 89, label: "Diastolic BP", unit: "mmHg" },
  tempC: { min: 36.1, max: 37.5, label: "Temperature", unit: "°C" },
  spo2: { min: 95, max: 100, label: "SpO₂", unit: "%" },
} as const;
export type VitalKey = keyof typeof VITAL_RANGES;

export function vitalFlags(v: Pick<Vitals, VitalKey>): VitalKey[] {
  return (Object.keys(VITAL_RANGES) as VitalKey[]).filter(
    (k) => v[k] < VITAL_RANGES[k].min || v[k] > VITAL_RANGES[k].max,
  );
}

export const medicalHistorySchema = z.object({
  id,
  personId: id,
  obstetric: z.object({
    gravida: z.number().int().nonnegative(),
    para: z.number().int().nonnegative(),
    living: z.number().int().nonnegative(),
    miscarriages: z.number().int().nonnegative(),
    ectopic: z.number().int().nonnegative(),
  }),
  gynaecological: z.string(),
  surgical: z.string(),
  medical: z.string(),
  drugAllergy: z.string(),
  family: z.string(),
  semen: z.string(),
  updatedAt: isoDateTime,
  updatedBy: id,
});
export type MedicalHistory = z.infer<typeof medicalHistorySchema>;

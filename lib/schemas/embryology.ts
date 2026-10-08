import { z } from "zod";
import { id, isoDate, isoDateTime } from "@/lib/schemas/common";

export const EmbryoStatus = z.enum(["culturing", "transferred", "cryopreserved", "thawed", "discarded", "arrested"]);
export type EmbryoStatus = z.infer<typeof EmbryoStatus>;
export const PgtResult = z.enum(["euploid", "aneuploid", "mosaic", "not-tested"]);
export type PgtResult = z.infer<typeof PgtResult>;

export const embryoSchema = z.object({
  id,
  cycleId: id,
  label: z.string().min(1),
  source: z.enum(["own", "donor-oocyte", "donor-sperm"]),
  day: z.number().int().min(0).max(7),
  stage: z.string().min(1),
  grade: z.string().optional(),
  pgtResult: PgtResult.default("not-tested"),
  status: EmbryoStatus,
  storagePositionId: id.optional(),
});
export type Embryo = z.infer<typeof embryoSchema>;

export const StorageItemKind = z.enum(["embryo", "oocyte", "sperm"]);
export type StorageItemKind = z.infer<typeof StorageItemKind>;

export const storagePositionSchema = z.object({
  id,
  tank: z.string(),
  canister: z.number().int().min(1).max(6),
  goblet: z.string(),
  straw: z.number().int().min(1).max(10),
  itemKind: StorageItemKind,
  itemId: id.optional(),
  label: z.string(),
  ownerPersonId: id.optional(),
  storedAt: isoDate,
  consentExpiry: isoDate,
});
export type StoragePosition = z.infer<typeof storagePositionSchema>;

export const cultureLogSchema = z.object({
  id,
  cycleId: id,
  date: isoDate,
  day: z.number().int().min(0).max(7),
  note: z.string().min(3),
  incubator: z.string(),
  by: id,
});
export type CultureLog = z.infer<typeof cultureLogSchema>;

export const custodyEventSchema = z.object({
  id,
  itemId: id,
  action: z.enum(["stored", "moved", "thawed", "transferred", "discarded", "graded", "status"]),
  detail: z.string(),
  at: isoDateTime,
  by: id,
  witnessId: id,
});
export type CustodyEvent = z.infer<typeof custodyEventSchema>;

export const TANKS = ["T1", "T2", "T3", "T4"] as const;
export const CANISTERS = [1, 2, 3, 4, 5, 6] as const;
export const GOBLETS = ["Red", "Blue", "Green", "Yellow"] as const;
export const STRAWS_PER_GOBLET = 10;
export const GOBLET_COLOURS: Record<(typeof GOBLETS)[number], string> = {
  Red: "#DC2626",
  Blue: "#0284C7",
  Green: "#16A34A",
  Yellow: "#D97706",
};

export const EMBRYO_STAGES: Record<number, string> = {
  0: "Oocyte (MII)",
  1: "2PN zygote",
  2: "4-cell",
  3: "8-cell",
  4: "Morula",
  5: "Blastocyst",
  6: "Expanded blastocyst",
  7: "Hatching blastocyst",
};

export function positionCode(p: Pick<StoragePosition, "tank" | "canister" | "goblet" | "straw">): string {
  return `${p.tank}-C${p.canister}-${p.goblet}-S${p.straw}`;
}

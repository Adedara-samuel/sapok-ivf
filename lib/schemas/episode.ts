import { z } from "zod";
import { id, isoDate } from "@/lib/schemas/common";

export const EpisodeType = z.enum(["IVF", "ICSI", "IUI", "FET", "DONOR-OOCYTE", "DONOR-SPERM", "SURROGACY"]);
export type EpisodeType = z.infer<typeof EpisodeType>;

export const CloseReason = z.enum([
  "live-birth",
  "pregnancy-ongoing",
  "not-pregnant",
  "miscarriage",
  "withdrawn",
  "transferred-out",
  "other",
]);
export type CloseReason = z.infer<typeof CloseReason>;

export const episodeSchema = z.object({
  id,
  ivfNo: z.string().min(1),
  patientId: id,
  partnerId: id.optional(),
  type: EpisodeType,
  doctorId: id,
  status: z.enum(["open", "on-hold", "closed"]),
  diagnosis: z.array(z.string()),
  openedAt: isoDate,
  closedAt: isoDate.optional(),
  closeReason: CloseReason.optional(),
  closeNote: z.string().optional(),
  branchId: id,
});
export type Episode = z.infer<typeof episodeSchema>;

export const closeEpisodeSchema = z.object({
  closeReason: CloseReason,
  closeNote: z.string().min(5, "Explain why the file is being closed (at least 5 characters)"),
});
export type CloseEpisodeInput = z.infer<typeof closeEpisodeSchema>;

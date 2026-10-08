import { z } from "zod";
import { id, isoDate, isoDateTime } from "@/lib/schemas/common";

export const ProcedureType = z.enum(["OCR", "PRP", "CYST_DRAINAGE", "PGT", "ET", "FET", "ANDROLOGY", "BIOPSY"]);
export type ProcedureType = z.infer<typeof ProcedureType>;

export const addendumSchema = z.object({
  id,
  body: z.string().min(3, "Write at least 3 characters"),
  authorId: id,
  at: isoDateTime,
});
export type Addendum = z.infer<typeof addendumSchema>;

export const procedureBaseSchema = z.object({
  id,
  cycleId: id,
  type: ProcedureType,
  date: isoDate,
  time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm"),
  surgeonId: id,
  embryologistId: id.optional(),
  scrubNurseId: id.optional(),
  count: z.number().int().nonnegative().optional(),
  embryoGrade: z.string().optional(),
  embryosTransferred: z.number().int().optional(),
  postOpNote: z.string().min(3, "Write a post-op note or remark"),
  status: z.enum(["draft", "posted"]),
  signatureDataUrl: z.string().optional(),
  signedAt: isoDateTime.optional(),
  addenda: z.array(addendumSchema),
});

export const procedureSchema = procedureBaseSchema.refine(
  (p) => p.status === "draft" || Boolean(p.signatureDataUrl && p.signedAt),
  { message: "A posted note must be signed", path: ["signatureDataUrl"] },
);
export type Procedure = z.infer<typeof procedureSchema>;

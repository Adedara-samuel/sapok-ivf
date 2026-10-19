import { z } from "zod";
import { id, isoDate, isoDateTime, money, phone } from "@/lib/schemas/common";

export const ConsentTemplate = z.enum([
  "ivf",
  "icsi",
  "cryo-storage",
  "embryo-disposition",
  "donor",
  "surrogacy",
  "anaesthesia",
  "pgt",
]);
export type ConsentTemplate = z.infer<typeof ConsentTemplate>;

export const consentSchema = z.object({
  id,
  episodeId: id,
  template: ConsentTemplate,
  version: z.string(),
  signerName: z.string().min(2, "Enter the signer's full name"),
  witnessName: z.string().optional(),
  signatureDataUrl: z.string().min(1, "A signature is required"),
  signedAt: isoDateTime,
  expiresAt: isoDate.optional(),
});
export type Consent = z.infer<typeof consentSchema>;

export const RequestKind = z.enum([
  "item",
  "leave",
  "manpower",
  "job",
  "reimbursement",
  "confirmation",
  "refund",
  "file-reopen",
  "wallet-refund",
]);
export type RequestKind = z.infer<typeof RequestKind>;
export const RequestStatus = z.enum(["pending", "approved", "rejected"]);
export type RequestStatus = z.infer<typeof RequestStatus>;

export const requestSchema = z.object({
  id,
  kind: RequestKind,
  title: z.string().min(3, "Give the request a short title"),
  details: z.string().min(3, "Add a few details"),
  amount: money.optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  entityId: id.optional(),
  attachmentName: z.string().optional(),
  requesterId: id,
  status: RequestStatus,
  approverId: id.optional(),
  comment: z.string().optional(),
  decidedAt: isoDateTime.optional(),
  createdAt: isoDateTime,
});
export type StaffRequest = z.infer<typeof requestSchema>;

export const StaffRole = z.enum([
  "frontdesk",
  "doctor",
  "embryologist",
  "nurse",
  "counsellor",
  "pharmacist",
  "lab",
  "radiology",
  "accountant",
  "hr",
  "manager",
  "admin",
]);
export type StaffRole = z.infer<typeof StaffRole>;

export const staffSchema = z.object({
  id,
  name: z.string().min(3, "Enter the full name"),
  role: StaffRole,
  email: z.email("Enter a valid email address"),
  phone,
  branchId: id,
  active: z.boolean(),
  note: z.string().optional(),
});
export type Staff = z.infer<typeof staffSchema>;

export const AuditAction = z.enum([
  "view",
  "create",
  "update",
  "post",
  "cancel",
  "print",
  "export",
  "login",
  "reset",
  "approve",
  "reject",
  "dispense",
  "sign",
  "access-denied",
  "break-glass",
]);
export type AuditAction = z.infer<typeof AuditAction>;

export const auditSchema = z.object({
  id,
  at: isoDateTime,
  actorId: id,
  action: AuditAction,
  entity: z.string(),
  entityId: id.optional(),
  summary: z.string(),
});
export type AuditEvent = z.infer<typeof auditSchema>;

export const notificationSchema = z.object({
  id,
  userId: id,
  title: z.string(),
  body: z.string(),
  href: z.string().optional(),
  at: isoDateTime,
  read: z.boolean(),
});
export type AppNotification = z.infer<typeof notificationSchema>;

export const WaitingStatus = z.enum(["waiting", "called", "in-consultation", "completed", "no-show"]);
export type WaitingStatus = z.infer<typeof WaitingStatus>;

export const waitingEntrySchema = z.object({
  id,
  personId: id,
  episodeId: id.optional(),
  date: isoDate,
  time: z.string(),
  arrivedAt: isoDateTime,
  calledAt: isoDateTime.optional(),
  seenAt: isoDateTime.optional(),
  completedAt: isoDateTime.optional(),
  doctorId: id,
  purpose: z.string(),
  status: WaitingStatus,
  branchId: id,
});
export type WaitingEntry = z.infer<typeof waitingEntrySchema>;

export const documentSchema = z.object({
  id,
  episodeId: id,
  name: z.string().min(1),
  category: z.enum(["referral", "lab-report", "scan", "consent", "id", "other"]),
  sizeKb: z.number().nonnegative(),
  mime: z.string(),
  dataUrl: z.string().optional(),
  uploadedAt: isoDateTime,
  uploadedBy: id,
});
export type PatientDocument = z.infer<typeof documentSchema>;

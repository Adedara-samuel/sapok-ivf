import { z } from "zod";
import { id, isoDate, isoDateTime, money } from "@/lib/schemas/common";

export const OrderKind = z.enum(["lab", "radiology", "pharmacy", "service"]);
export type OrderKind = z.infer<typeof OrderKind>;
export const OrderStatus = z.enum(["ordered", "in-progress", "resulted", "dispensed", "cancelled"]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const orderSchema = z.object({
  id,
  episodeId: id,
  kind: OrderKind,
  catalogCode: z.string().min(1),
  name: z.string().min(1),
  qty: z.number().int().positive("Quantity must be at least 1"),
  unitPrice: money,
  amount: money,
  status: OrderStatus,
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  resultText: z.string().optional(),
  abnormal: z.boolean().optional(),
  critical: z.boolean().optional(),
  resultAttachment: z.string().optional(),
  resultedAt: isoDateTime.optional(),
  cancelReason: z.string().optional(),
  dispensedAt: isoDateTime.optional(),
  dispensedBy: id.optional(),
  orderedBy: id,
  at: isoDateTime,
});
export type Order = z.infer<typeof orderSchema>;

export const CatalogKind = z.enum(["lab", "radiology", "service", "drug"]);
export type CatalogKind = z.infer<typeof CatalogKind>;

export const catalogItemSchema = z.object({
  code: z.string(),
  name: z.string(),
  kind: CatalogKind,
  price: money,
  unit: z.string().optional(),
  reorderLevel: z.number().int().nonnegative().optional(),
  refRange: z.string().optional(),
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;

export const drugBatchSchema = z.object({
  id,
  code: z.string(),
  batchNo: z.string(),
  qty: z.number().int().nonnegative(),
  expiry: isoDate,
  receivedAt: isoDate,
});
export type DrugBatch = z.infer<typeof drugBatchSchema>;

export const stockMovementSchema = z.object({
  id,
  code: z.string(),
  batchId: id,
  delta: z.number().int(),
  reason: z.string().min(3, "Give a reason for the adjustment"),
  kind: z.enum(["receive", "dispense", "adjust"]),
  orderId: id.optional(),
  at: isoDateTime,
  by: id,
});
export type StockMovement = z.infer<typeof stockMovementSchema>;

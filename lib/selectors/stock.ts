import type { DrugBatch } from "@/lib/schemas/orders";
import { todayIso } from "@/lib/utils/dates";

/** Usable (non-expired) stock for a drug code. */
export function availableStock(batches: readonly DrugBatch[], code: string, onDate: string = todayIso()): number {
  return batches.filter((b) => b.code === code && b.expiry >= onDate).reduce((s, b) => s + b.qty, 0);
}

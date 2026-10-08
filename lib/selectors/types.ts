import type { SeedData } from "@/lib/seed/types";

/** Read model shared by dashboards, reports and tests (same shape as the seed). */
export type ClinicDb = Pick<
  SeedData,
  | "persons"
  | "episodes"
  | "cycles"
  | "orders"
  | "charges"
  | "payments"
  | "refunds"
  | "donors"
  | "surrogates"
  | "requests"
  | "waiting"
  | "storage"
  | "batches"
  | "vitals"
  | "embryos"
  | "procedures"
  | "staff"
>;

export interface DateRange {
  from?: string;
  to?: string;
}

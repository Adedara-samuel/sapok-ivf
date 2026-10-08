import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  auditSchema,
  chargeSchema,
  consentSchema,
  counsellingSchema,
  cultureLogSchema,
  custodyEventSchema,
  cycleSchema,
  documentSchema,
  donorSchema,
  drugBatchSchema,
  embryoSchema,
  episodeSchema,
  hmoClaimSchema,
  medicalHistorySchema,
  noteSchema,
  notificationSchema,
  orderSchema,
  paymentSchema,
  personSchema,
  procedureSchema,
  requestSchema,
  staffSchema,
  stimulationEntrySchema,
  stockMovementSchema,
  storagePositionSchema,
  surrogateSchema,
  vitalsSchema,
  waitingEntrySchema,
} from "@/lib/schemas";
import { buildSeed } from "@/lib/seed/build";
import type { SeedData } from "@/lib/seed/types";
import { shiftDate } from "@/lib/utils/dates";

const ANCHOR = new Date("2026-10-08T10:30:00+01:00");
const seed = buildSeed(ANCHOR);

const schemaFor: Partial<Record<keyof SeedData, z.ZodType>> = {
  staff: staffSchema,
  persons: personSchema,
  episodes: episodeSchema,
  cycles: cycleSchema,
  notes: noteSchema,
  stimulation: stimulationEntrySchema,
  vitals: vitalsSchema,
  histories: medicalHistorySchema,
  procedures: procedureSchema,
  embryos: embryoSchema,
  storage: storagePositionSchema,
  cultureLogs: cultureLogSchema,
  custody: custodyEventSchema,
  orders: orderSchema,
  batches: drugBatchSchema,
  movements: stockMovementSchema,
  charges: chargeSchema,
  payments: paymentSchema,
  claims: hmoClaimSchema,
  donors: donorSchema,
  surrogates: surrogateSchema,
  counselling: counsellingSchema,
  consents: consentSchema,
  requests: requestSchema,
  audit: auditSchema,
  notifications: notificationSchema,
  waiting: waitingEntrySchema,
  documents: documentSchema,
};

describe("seed dataset", () => {
  it.each(Object.entries(schemaFor))("every %s record passes its Zod schema", (key, schema) => {
    const rows = seed[key as keyof SeedData];
    expect(Array.isArray(rows)).toBe(true);
    (rows as unknown[]).forEach((row) => {
      const result = schema.safeParse(row);
      if (!result.success) throw new Error(`${key}: ${JSON.stringify(row).slice(0, 200)} → ${result.error.message}`);
    });
  });

  it("is deterministic for the same anchor date", () => {
    expect(JSON.stringify(buildSeed(ANCHOR))).toBe(JSON.stringify(seed));
  });

  it("contains 40 couples with the required numbering", () => {
    const patients = seed.persons.filter((p) => p.roles.includes("patient"));
    expect(patients).toHaveLength(40);
    expect(seed.episodes).toHaveLength(39); // couple 12 has no episode yet (first visit)
    expect(seed.persons[0]?.prn).toBe("PRN-BR01-000101");
    expect(seed.episodes[0]?.ivfNo).toBe("IVF-2026-0001");
    expect(seed.persons.some((p) => p.branchId === "BR-02")).toBe(true);
  });

  it("hand-authors couple 1 exactly", () => {
    const adaobi = seed.persons.find((p) => p.firstName === "Adaobi" && p.lastName === "Okafor");
    const ep = seed.episodes.find((e) => e.patientId === adaobi?.id);
    const cycle = seed.cycles.find((c) => c.episodeId === ep?.id && c.number === 2);
    expect(cycle?.stage).toBe("stimulation");
    const entries = seed.stimulation.filter((s) => s.cycleId === cycle?.id);
    const last = entries[entries.length - 1];
    expect(last?.follicles).toEqual({ right: [14, 12, 11, 10], left: [15, 13, 11, 9] });
    expect(last?.endometriumMm).toBe(8.2);
    expect(last?.e2).toBe(1450);
    expect(last?.nextScan).toBe(shiftDate("2026-10-08", 2));
  });

  it("meets the transactional data rules", () => {
    expect(seed.orders.filter((o) => o.kind === "pharmacy" && o.status === "cancelled")).toHaveLength(6);
    expect(seed.counselling).toHaveLength(14);
    expect(seed.requests).toHaveLength(12);
    expect(seed.requests.filter((r) => r.status === "pending")).toHaveLength(6);
    expect(seed.requests.filter((r) => r.status === "approved")).toHaveLength(4);
    expect(seed.requests.filter((r) => r.status === "rejected")).toHaveLength(2);
    expect(seed.audit.length).toBeGreaterThanOrEqual(78);
    const today = seed.waiting.filter((w) => w.date === "2026-10-08");
    expect(today).toHaveLength(6);
    expect(today.filter((w) => w.status === "waiting")).toHaveLength(2);
    expect(today.filter((w) => w.status === "in-consultation")).toHaveLength(2);
    expect(seed.waiting.filter((w) => w.date === "2026-10-07" && w.status === "no-show")).toHaveLength(2);
    expect(seed.donors.filter((d) => d.kind === "oocyte")).toHaveLength(8);
    expect(seed.donors.filter((d) => d.kind === "sperm")).toHaveLength(4);
    expect(seed.surrogates).toHaveLength(6);
  });

  it("orders always have charges and payments are numbered", () => {
    const chargedOrderIds = new Set(seed.charges.map((c) => c.orderId));
    seed.orders.forEach((o) => expect(chargedOrderIds.has(o.id)).toBe(true));
    seed.episodes.forEach((e) => {
      const n = seed.orders.filter((o) => o.episodeId === e.id).length;
      expect(n).toBeGreaterThanOrEqual(2);
    });
    expect(seed.payments[0]?.receiptNo).toBe("RCP-000001");
    seed.charges.forEach((c) => expect(c.paid).toBeLessThanOrEqual(c.amount));
  });

  it("has cryo-storage with expiring and expired consents", () => {
    expect(seed.storage.length).toBeGreaterThanOrEqual(34);
    expect(seed.storage.length).toBeLessThanOrEqual(42);
    const today = "2026-10-08";
    expect(seed.storage.filter((p) => p.consentExpiry < today)).toHaveLength(1);
    expect(
      seed.storage.filter((p) => p.consentExpiry >= today && p.consentExpiry <= shiftDate(today, 45)),
    ).toHaveLength(3);
    const keys = new Set(seed.storage.map((p) => `${p.tank}-${p.canister}-${p.goblet}-${p.straw}`));
    expect(keys.size).toBe(seed.storage.length);
  });

  it("has out-of-range vitals to demonstrate flags", () => {
    expect(seed.vitals.some((v) => v.spo2 === 93)).toBe(true);
    expect(seed.vitals.some((v) => v.bpSys === 150 && v.bpDia === 95)).toBe(true);
  });
});

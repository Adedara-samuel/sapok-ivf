import { z } from "zod";
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
  refundSchema,
  requestSchema,
  staffSchema,
  stimulationEntrySchema,
  stockMovementSchema,
  storagePositionSchema,
  surrogateSchema,
  vitalsSchema,
  waitingEntrySchema,
} from "@/lib/schemas";
import { audit, useAuditStore } from "@/lib/stores/audit";
import { useBillingStore } from "@/lib/stores/billing";
import { useClinicalStore } from "@/lib/stores/clinical";
import { useConsentStore } from "@/lib/stores/consent";
import { useCounsellingStore } from "@/lib/stores/counselling";
import { validate } from "@/lib/stores/core";
import { useCycleStore } from "@/lib/stores/cycle";
import { useEmbryologyStore } from "@/lib/stores/embryology";
import { useEpisodeStore } from "@/lib/stores/episode";
import { useNotificationStore } from "@/lib/stores/notifications";
import { useOrderStore } from "@/lib/stores/orders";
import { usePersonStore } from "@/lib/stores/person";
import { useProcedureStore } from "@/lib/stores/procedure";
import { useProgrammeStore } from "@/lib/stores/programme";
import { useRequestStore } from "@/lib/stores/requests";
import { useStaffStore } from "@/lib/stores/staff";
import { useWaitingStore } from "@/lib/stores/waiting";

export const exportFileSchema = z.object({
  exportedAt: z.string(),
  persons: z.array(personSchema),
  staff: z.array(staffSchema),
  episodes: z.array(episodeSchema),
  cycles: z.array(cycleSchema),
  clinical: z.object({
    notes: z.array(noteSchema),
    stimulation: z.array(stimulationEntrySchema),
    vitals: z.array(vitalsSchema),
    histories: z.array(medicalHistorySchema),
    documents: z.array(documentSchema),
  }),
  procedures: z.array(procedureSchema),
  embryology: z.object({
    embryos: z.array(embryoSchema),
    storage: z.array(storagePositionSchema),
    cultureLogs: z.array(cultureLogSchema),
    custody: z.array(custodyEventSchema),
  }),
  orders: z.object({
    orders: z.array(orderSchema),
    batches: z.array(drugBatchSchema),
    movements: z.array(stockMovementSchema),
  }),
  billing: z.object({
    charges: z.array(chargeSchema),
    payments: z.array(paymentSchema),
    refunds: z.array(refundSchema),
    claims: z.array(hmoClaimSchema),
  }),
  programme: z.object({ donors: z.array(donorSchema), surrogates: z.array(surrogateSchema) }),
  counselling: z.array(counsellingSchema),
  consents: z.array(consentSchema),
  requests: z.array(requestSchema),
  notifications: z.array(notificationSchema),
  waiting: z.array(waitingEntrySchema),
  audit: z.array(auditSchema),
});

/** Validates a full export file and replaces all data stores with it. */
export function importAllData(raw: unknown): void {
  const d = validate(exportFileSchema, raw);
  usePersonStore.setState({ persons: d.persons });
  useStaffStore.setState({ staff: d.staff });
  useEpisodeStore.setState({ episodes: d.episodes });
  useCycleStore.setState({ cycles: d.cycles });
  useClinicalStore.setState({ ...d.clinical });
  useProcedureStore.setState({ procedures: d.procedures });
  useEmbryologyStore.setState({ ...d.embryology });
  useOrderStore.setState({ ...d.orders });
  useBillingStore.setState({ ...d.billing });
  useProgrammeStore.setState({ ...d.programme });
  useCounsellingStore.setState({ records: d.counselling });
  useConsentStore.setState({ consents: d.consents });
  useRequestStore.setState({ requests: d.requests });
  useNotificationStore.setState({ notifications: d.notifications });
  useWaitingStore.setState({ entries: d.waiting });
  useAuditStore.setState({ events: d.audit });
  audit("update", "system", `Imported data snapshot from ${d.exportedAt}`);
}

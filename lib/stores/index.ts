import type { SeedData } from "@/lib/seed/types";
import { APP_CONFIG } from "@/lib/config";
import { audit, useAuditStore } from "@/lib/stores/audit";
import { useBillingStore } from "@/lib/stores/billing";
import { useClinicalStore } from "@/lib/stores/clinical";
import { useConsentStore } from "@/lib/stores/consent";
import { useCredentialStore } from "@/lib/stores/credentials";
import { useCounsellingStore } from "@/lib/stores/counselling";
import { useCycleStore } from "@/lib/stores/cycle";
import { useEmbryologyStore } from "@/lib/stores/embryology";
import { useEpisodeStore } from "@/lib/stores/episode";
import { useNotificationStore } from "@/lib/stores/notifications";
import { useOrderStore } from "@/lib/stores/orders";
import { usePersonStore } from "@/lib/stores/person";
import { useProcedureStore } from "@/lib/stores/procedure";
import { useProgrammeStore } from "@/lib/stores/programme";
import { onRequestDecided, useRequestStore } from "@/lib/stores/requests";
import { useSessionStore } from "@/lib/stores/session";
import { useSettingsStore } from "@/lib/stores/settings";
import { useStaffStore } from "@/lib/stores/staff";
import { useUiStore } from "@/lib/stores/ui";
import { useWaitingStore } from "@/lib/stores/waiting";
import { todayIso } from "@/lib/utils/dates";

interface Hydratable {
  persist: { rehydrate: () => Promise<void> | void; hasHydrated: () => boolean; getOptions: () => { name?: string } };
}

interface DataStore extends Hydratable {
  getState: () => { reset: (seed: SeedData) => void };
}

/** Stores whose content comes from the seed (reset restores them). */
export const DATA_STORES: DataStore[] = [
  useAuditStore,
  usePersonStore,
  useStaffStore,
  useEpisodeStore,
  useCycleStore,
  useClinicalStore,
  useProcedureStore,
  useEmbryologyStore,
  useOrderStore,
  useBillingStore,
  useProgrammeStore,
  useCounsellingStore,
  useConsentStore,
  useRequestStore,
  useNotificationStore,
  useWaitingStore,
];

const ALL_STORES: Hydratable[] = [...DATA_STORES, useSettingsStore, useSessionStore, useUiStore, useCredentialStore];

// Cross-domain reactions to approvals (one approvals engine, many consumers).
onRequestDecided((request) => useBillingStore.getState().applyRefundDecision(request));

/** Loads persisted data; stores with nothing saved yet are filled from the seed (computed only when needed). */
export async function hydrateAllStores(): Promise<void> {
  await Promise.all(ALL_STORES.map((s) => s.persist.rehydrate()));
  const settings = useSettingsStore.getState();
  const clinicName = settings.clinic.clinicName === "RHV IVF" ? APP_CONFIG.name : settings.clinic.clinicName;
  const branches = settings.branches.map((branch) =>
    branch.name === "RHV IVF Centre, Redemption City"
      ? { ...branch, name: "Overcare IVF Centre, Redemption City" }
      : branch,
  );
  if (
    clinicName !== settings.clinic.clinicName ||
    branches.some((branch, index) => branch.name !== settings.branches[index]?.name)
  ) {
    useSettingsStore.setState({ clinic: { ...settings.clinic, clinicName }, branches });
  }
  const missing = DATA_STORES.filter((s) => {
    const key = s.persist.getOptions().name;
    return !key || localStorage.getItem(key) === null;
  });
  if (missing.length > 0) {
    const { getSeed } = await import("@/lib/seed/build");
    const seed = getSeed();
    missing.forEach((s) => s.getState().reset(seed));
  }
  const session = useSessionStore.getState();
  if (!session.seedDay) session.setSeedDay(todayIso());
}

/** Restore every data store to the exact seed and write one audit event. */
export async function rootReset(): Promise<void> {
  const { getSeed } = await import("@/lib/seed/build");
  const seed = getSeed();
  DATA_STORES.forEach((store) => store.getState().reset(seed));
  useSettingsStore.getState().reset();
  useCredentialStore.getState().reset();
  useSessionStore.getState().setSeedDay(seed.anchor);
  audit("reset", "system", "Demo data reset to seed");
}

/** Snapshot of all persisted data for "Export all JSON". */
export function exportAllData(): Record<string, unknown> {
  return {
    exportedAt: new Date().toISOString(),
    persons: usePersonStore.getState().persons,
    staff: useStaffStore.getState().staff,
    episodes: useEpisodeStore.getState().episodes,
    cycles: useCycleStore.getState().cycles,
    clinical: (({ notes, stimulation, vitals, histories, documents }) => ({
      notes,
      stimulation,
      vitals,
      histories,
      documents,
    }))(useClinicalStore.getState()),
    procedures: useProcedureStore.getState().procedures,
    embryology: (({ embryos, storage, cultureLogs, custody }) => ({ embryos, storage, cultureLogs, custody }))(
      useEmbryologyStore.getState(),
    ),
    orders: (({ orders, batches, movements }) => ({ orders, batches, movements }))(useOrderStore.getState()),
    billing: (({ charges, payments, refunds, claims }) => ({ charges, payments, refunds, claims }))(
      useBillingStore.getState(),
    ),
    programme: (({ donors, surrogates }) => ({ donors, surrogates }))(useProgrammeStore.getState()),
    counselling: useCounsellingStore.getState().records,
    consents: useConsentStore.getState().consents,
    requests: useRequestStore.getState().requests,
    notifications: useNotificationStore.getState().notifications,
    waiting: useWaitingStore.getState().entries,
    audit: useAuditStore.getState().events,
  };
}

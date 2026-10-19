import type { SeedData } from "@/lib/seed/types";
import { APP_CONFIG } from "@/lib/config";
import type { Tenant } from "@/lib/schemas/platform";
import { effectiveStatus, statusMessage } from "@/lib/platform/subscription";
import { audit, useAuditStore } from "@/lib/stores/audit";
import { hasPersisted, setWriteBlock } from "@/lib/stores/core";
import { usePlatformStore } from "@/lib/stores/platform";
import { useWalletStore } from "@/lib/stores/wallet";
import { activeTenantSlug, DEFAULT_TENANT, scopedKey, setActiveTenantSlug } from "@/lib/tenancy";
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
  useWalletStore,
];

const TENANT_STORES: Hydratable[] = [...DATA_STORES, useSettingsStore, useSessionStore, useUiStore, useCredentialStore];

/**
 * Bump when the shape or meaning of seeded data changes. Saved demo data from an older version is replaced by the
 * new seed in one go, so related stores (e.g. billing and accounts) never disagree after an upgrade.
 */
export const DATA_VERSION = 2;
const versionKey = () => scopedKey(`${APP_CONFIG.storagePrefix}:data-version`);

// Cross-domain reactions to approvals (one approvals engine, many consumers).
onRequestDecided((request) => useBillingStore.getState().applyRefundDecision(request));
onRequestDecided((request) => useWalletStore.getState().applyWithdrawalDecision(request));

/** The hospital whose data is loaded in this browser tab. */
export function activeTenant(): Tenant | undefined {
  const slug = activeTenantSlug();
  return usePlatformStore.getState().tenants.find((t) => t.slug === slug);
}

async function seedFor(tenant: Tenant | undefined): Promise<SeedData> {
  const { getSeed, emptySeed } = await import("@/lib/seed/build");
  if (tenant?.dataMode === "empty") return emptySeed(tenant.admin);
  const seed = getSeed();
  // sample data carries the hospital's own name on account numbers and messages
  if (tenant && tenant.slug !== DEFAULT_TENANT) {
    const upper = tenant.name.toUpperCase();
    seed.wallets.forEach((w) => {
      if (w.virtualAccount)
        w.virtualAccount.accountName = w.virtualAccount.accountName.replace(/^OVERCARE IVF/, upper).slice(0, 40);
    });
    seed.walletMessages.forEach((m) => {
      m.body = m.body.replace(/^Overcare IVF/, tenant.name);
    });
  }
  // a newly onboarded hospital with sample data also gets its own admin as a user
  if (tenant && tenant.slug !== DEFAULT_TENANT && !seed.staff.some((s) => s.email === tenant.admin.email)) {
    seed.staff.push({
      id: "S99",
      name: tenant.admin.name,
      role: "admin",
      email: tenant.admin.email,
      phone: tenant.admin.phone,
      branchId: "BR-01",
      active: true,
    });
  }
  return seed;
}

/** Applies the hospital's platform profile (name, branch) and its subscription state to the loaded stores. */
export function applyTenant(tenant: Tenant | undefined): void {
  if (!tenant) return;
  const settings = useSettingsStore.getState();
  const branches =
    tenant.slug === DEFAULT_TENANT
      ? settings.branches.map((b) =>
          b.name === "RHV IVF Centre, Redemption City" ? { ...b, name: "Overcare IVF Centre, Redemption City" } : b,
        )
      : [{ id: "BR-01", name: `${tenant.name}, ${tenant.city}`, short: tenant.city, address: tenant.address }];
  if (settings.clinic.clinicName !== tenant.name || JSON.stringify(settings.branches) !== JSON.stringify(branches)) {
    settings.setBranding(tenant.name, branches);
  }
  const session = useSessionStore.getState();
  if (!branches.some((b) => b.id === session.branchId)) session.switchBranch(branches[0]?.id ?? "BR-01");
  const status = effectiveStatus(tenant, todayIso());
  setWriteBlock(status === "read-only" || status === "suspended" ? statusMessage(tenant, todayIso()) : null);
}

/** Loads persisted data; stores with nothing saved yet are filled from the seed (computed only when needed). */
export async function hydrateAllStores(): Promise<void> {
  await usePlatformStore.persist.rehydrate();
  if (!activeTenant()) setActiveTenantSlug(DEFAULT_TENANT);
  const tenant = activeTenant();
  await Promise.all(TENANT_STORES.map((s) => s.persist.rehydrate()));

  const missing = DATA_STORES.filter((s) => !hasPersisted(s.persist.getOptions().name ?? ""));
  const outdated = missing.length < DATA_STORES.length && localStorage.getItem(versionKey()) !== String(DATA_VERSION);
  if (missing.length > 0 || outdated) {
    const seed = await seedFor(tenant);
    (outdated ? DATA_STORES : missing).forEach((s) => s.getState().reset(seed));
    if (outdated) audit("reset", "system", "Demo upgraded — data refreshed to the new seed");
  }
  localStorage.setItem(versionKey(), String(DATA_VERSION));
  if (!hasPersisted(useSettingsStore.persist.getOptions().name ?? "")) useSettingsStore.getState().reset();

  applyTenant(tenant);
  const session = useSessionStore.getState();
  if (!session.seedDay) session.setSeedDay(todayIso());
}

/** Restore every data store to the exact seed and write one audit event. */
export async function rootReset(): Promise<void> {
  const tenant = activeTenant();
  const seed = await seedFor(tenant);
  DATA_STORES.forEach((store) => store.getState().reset(seed));
  useSettingsStore.getState().reset();
  useCredentialStore.getState().reset();
  useSessionStore.getState().setSeedDay(seed.anchor);
  applyTenant(tenant);
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
    accounts: (({ wallets, entries, settlements, messages }) => ({ wallets, entries, settlements, messages }))(
      useWalletStore.getState(),
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

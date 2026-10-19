import { APP_CONFIG } from "@/lib/config";

/**
 * Multi-tenancy for the browser demo.
 *
 * Every hospital (tenant) keeps its own copy of every store in localStorage. The default tenant keeps the
 * original keys ("rhv-ivf:<store>") so existing demo data survives; other tenants use "rhv-ivf@<slug>:<store>".
 * Platform data (hospitals, super-admin session) is shared and never scoped.
 *
 * In production this becomes a `tenant_id` column on every table enforced by Postgres row-level security,
 * and the tenant is resolved from the request's subdomain.
 */

export const DEFAULT_TENANT = "overcare";
const ACTIVE_KEY = `${APP_CONFIG.storagePrefix}:active-tenant`;

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function activeTenantSlug(): string {
  return safeStorage()?.getItem(ACTIVE_KEY) ?? DEFAULT_TENANT;
}

export function setActiveTenantSlug(slug: string): void {
  safeStorage()?.setItem(ACTIVE_KEY, slug);
}

/** localStorage key for a store's persisted name ("rhv-ivf:persons") in a given tenant. */
export function scopedKey(persistName: string, slug: string = activeTenantSlug()): string {
  if (slug === DEFAULT_TENANT) return persistName;
  const prefix = `${APP_CONFIG.storagePrefix}:`;
  const store = persistName.startsWith(prefix) ? persistName.slice(prefix.length) : persistName;
  return `${APP_CONFIG.storagePrefix}@${slug}:${store}`;
}

/** Read another tenant's persisted store without switching to it (used by the super-admin console). */
export function readTenantStore<T>(slug: string, store: string): T | null {
  const raw = safeStorage()?.getItem(scopedKey(`${APP_CONFIG.storagePrefix}:${store}`, slug));
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { state: T }).state;
  } catch {
    return null;
  }
}

/** Remove every persisted store of a tenant (used when a hospital is deleted from the demo). */
export function clearTenantData(slug: string): void {
  const storage = safeStorage();
  if (!storage || slug === DEFAULT_TENANT) return;
  const prefix = `${APP_CONFIG.storagePrefix}@${slug}:`;
  Object.keys(storage)
    .filter((k) => k.startsWith(prefix))
    .forEach((k) => storage.removeItem(k));
}

/** URL-safe hospital slug from a name: "Lagoon Fertility Centre" → "lagoon-fertility-centre". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 32)
    .replace(/-+$/, "");
}

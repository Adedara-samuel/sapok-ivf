import type { z } from "zod";
import { create, type StateCreator } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { APP_CONFIG } from "@/lib/config";
import { scopedKey } from "@/lib/tenancy";

/** Error thrown by store actions; `fieldErrors` maps form paths to messages. */
export class DomainError extends Error {
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "DomainError";
    this.fieldErrors = fieldErrors;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/** Parse with Zod; on failure throw a DomainError carrying field-level messages. */
export function validate<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const key = issue.path.map(String).join(".") || "_form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  });
  const first = result.error.issues[0];
  throw new DomainError(
    first ? `${first.path.length ? `${first.path.join(".")}: ` : ""}${first.message}` : "Invalid data",
    fieldErrors,
  );
}

export function assert(condition: unknown, message: string, field?: string): asserts condition {
  if (!condition) throw new DomainError(message, field ? { [field]: message } : {});
}

// ------------------------------------------------------------------ read-only mode (lapsed subscription)

let writeBlock: string | null = null;

/** Set by the tenant gate when the hospital's subscription only allows reading. */
export function setWriteBlock(message: string | null): void {
  writeBlock = message;
}

export function writeBlockMessage(): string | null {
  return writeBlock;
}

/** Throws when the hospital is in read-only mode. Called before every user-initiated write. */
export function assertWritable(): void {
  if (writeBlock) throw new DomainError(writeBlock);
}

// ------------------------------------------------------------------ persistence

/** localStorage scoped to the active hospital (see lib/tenancy.ts). */
const tenantStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(scopedKey(name)),
  setItem: (name, value) => localStorage.setItem(scopedKey(name), value),
  removeItem: (name) => localStorage.removeItem(scopedKey(name)),
};

type DomainInit<S> = StateCreator<S, [["zustand/persist", unknown], ["zustand/immer", never]]>;

export interface DomainStoreOptions {
  version?: number;
  /** Upgrade state saved by an older version of the app. */
  migrate?: (persisted: unknown, version: number) => unknown;
  /** Platform-wide stores are shared by every hospital and never scoped. */
  shared?: boolean;
}

/** Zustand store with immer + localStorage persistence. Hydration is manual (see AppProviders). */
export function createDomainStore<S extends object>(
  name: string,
  init: DomainInit<S>,
  options: DomainStoreOptions = {},
) {
  return create<S>()(
    persist(immer(init), {
      name: `${APP_CONFIG.storagePrefix}:${name}`,
      version: options.version ?? 1,
      migrate: options.migrate as ((persisted: unknown, version: number) => S) | undefined,
      skipHydration: true,
      storage: createJSONStorage(() => (options.shared ? localStorage : tenantStorage)),
    }),
  );
}

/** True when a store has something saved for the active hospital. */
export function hasPersisted(persistName: string): boolean {
  return localStorage.getItem(scopedKey(persistName)) !== null;
}

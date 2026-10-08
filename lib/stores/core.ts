import type { z } from "zod";
import { create, type StateCreator } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { APP_CONFIG } from "@/lib/config";

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

type DomainInit<S> = StateCreator<S, [["zustand/persist", unknown], ["zustand/immer", never]]>;

/** Zustand store with immer + localStorage persistence. Hydration is manual (see AppProviders). */
export function createDomainStore<S extends object>(name: string, init: DomainInit<S>, version = 1) {
  return create<S>()(
    persist(immer(init), {
      name: `${APP_CONFIG.storagePrefix}:${name}`,
      version,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
    }),
  );
}

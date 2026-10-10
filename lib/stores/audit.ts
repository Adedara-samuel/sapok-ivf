import { auditSchema, type AuditAction, type AuditEvent } from "@/lib/schemas/admin";
import type { SeedData } from "@/lib/seed/types";
import { createDomainStore, validate } from "@/lib/stores/core";
import { currentActorId } from "@/lib/stores/session";
import { newId } from "@/lib/utils/ids";
import { nowIso } from "@/lib/utils/dates";

export interface AuditState {
  events: AuditEvent[];
  log: (action: AuditAction, entity: string, summary: string, entityId?: string) => AuditEvent;
  reset: (seed: SeedData) => void;
}

export const useAuditStore = createDomainStore<AuditState>("audit", (set) => ({
  events: [],
  log: (action, entity, summary, entityId) => {
    const event = validate(auditSchema, {
      id: newId("AUD"),
      at: nowIso(),
      actorId: currentActorId(),
      action,
      entity,
      entityId,
      summary,
    });
    set((s) => {
      s.events.push(event);
    });
    return event;
  },
  reset: (seed) =>
    set((s) => {
      s.events = seed.audit;
    }),
}));

/** Append an audit event from anywhere (stores, services, components). */
export function audit(action: AuditAction, entity: string, summary: string, entityId?: string): AuditEvent {
  return useAuditStore.getState().log(action, entity, summary, entityId);
}

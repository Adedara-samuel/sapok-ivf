import { z } from "zod";
import { APP_CONFIG, BRANCHES } from "@/lib/config";
import {
  DEFAULT_CONSENT_TEMPLATES,
  DEFAULT_PROCEDURE_FORMS,
  PROTOCOL_TEMPLATES,
  type ConsentTemplateConfig,
  type ProcedureFormConfig,
  type ProtocolTemplate,
} from "@/lib/constants/clinical";
import { DEFAULT_ROLE_CAPABILITIES, type Capability, type PermissionMatrix } from "@/lib/permissions";
import type { StaffRole } from "@/lib/schemas/admin";
import type { ProcedureType } from "@/lib/schemas/procedure";
import { audit } from "@/lib/stores/audit";
import { createDomainStore, DomainError, validate } from "@/lib/stores/core";

export const clinicSettingsSchema = z.object({
  clinicName: z.string().min(3, "Clinic name needs at least 3 characters"),
  currencySymbol: z.string().min(1).max(3),
  receiptPrefix: z.string().min(2).max(6),
  ivfPrefix: z.string().min(3).max(12),
});
export type ClinicSettings = z.infer<typeof clinicSettingsSchema>;

export interface Branch {
  id: string;
  name: string;
  short: string;
  address: string;
}

export interface SettingsState {
  clinic: ClinicSettings;
  branches: Branch[];
  matrix: PermissionMatrix;
  consentTemplates: ConsentTemplateConfig[];
  procedureForms: ProcedureFormConfig[];
  protocols: ProtocolTemplate[];
  updateClinic: (input: ClinicSettings) => void;
  toggleCapability: (role: StaffRole, capability: Capability) => void;
  updateProcedureForm: (type: ProcedureType, patch: Partial<Omit<ProcedureFormConfig, "type">>) => void;
  updateConsentTemplate: (
    id: ConsentTemplateConfig["id"],
    patch: Partial<Pick<ConsentTemplateConfig, "title" | "version" | "body">>,
  ) => void;
  updateProtocol: (id: ProtocolTemplate["id"], patch: Partial<Pick<ProtocolTemplate, "description" | "drugs">>) => void;
  reset: () => void;
}

const defaults = () => ({
  clinic: {
    clinicName: APP_CONFIG.name,
    currencySymbol: APP_CONFIG.currencySymbol,
    receiptPrefix: "RCP",
    ivfPrefix: "IVF-2026",
  },
  branches: BRANCHES.map((b) => ({ ...b })),
  matrix: structuredClone(DEFAULT_ROLE_CAPABILITIES),
  consentTemplates: structuredClone(DEFAULT_CONSENT_TEMPLATES),
  procedureForms: structuredClone(DEFAULT_PROCEDURE_FORMS),
  protocols: structuredClone(PROTOCOL_TEMPLATES),
});

export const useSettingsStore = createDomainStore<SettingsState>("settings", (set, get) => ({
  ...defaults(),
  updateClinic: (input) => {
    const clinic = validate(clinicSettingsSchema, input);
    set((s) => {
      s.clinic = clinic;
    });
    audit("update", "settings", "Updated clinic configuration");
  },
  toggleCapability: (role, capability) => {
    if (role === "admin" && (capability === "admin.view" || capability === "admin.settings"))
      throw new DomainError("Admins must keep access to administration to avoid lock-out");
    const has = get().matrix[role].includes(capability);
    set((s) => {
      s.matrix[role] = has ? s.matrix[role].filter((c) => c !== capability) : [...s.matrix[role], capability];
    });
    audit("update", "permission", `${has ? "Revoked" : "Granted"} ${capability} for role ${role}`);
  },
  updateProcedureForm: (type, patch) => {
    set((s) => {
      const form = s.procedureForms.find((f) => f.type === type);
      if (form) Object.assign(form, patch);
    });
    audit("update", "settings", `Updated procedure form ${type}`);
  },
  updateConsentTemplate: (id, patch) => {
    if (patch.title !== undefined && patch.title.trim().length < 3)
      throw new DomainError("Title is too short", { title: "Title is too short" });
    set((s) => {
      const t = s.consentTemplates.find((c) => c.id === id);
      if (t) Object.assign(t, patch);
    });
    audit("update", "settings", `Updated consent template ${id}`);
  },
  updateProtocol: (id, patch) => {
    set((s) => {
      const p = s.protocols.find((x) => x.id === id);
      if (p) Object.assign(p, patch);
    });
    audit("update", "settings", `Updated protocol template ${id}`);
  },
  reset: () => set(() => defaults()),
}));

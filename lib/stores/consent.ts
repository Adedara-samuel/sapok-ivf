import { consentSchema, type Consent, type ConsentTemplate } from "@/lib/schemas/admin";
import { getSeed, seedSlice } from "@/lib/seed/build";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { assert, createDomainStore, validate } from "@/lib/stores/core";
import { nowIso, shiftDate, todayIso } from "@/lib/utils/dates";
import { newId } from "@/lib/utils/ids";

export interface SignConsentInput {
  template: ConsentTemplate;
  version: string;
  signerName: string;
  witnessName?: string;
  signatureDataUrl: string;
  validityMonths?: number;
}

export interface ConsentState {
  consents: Consent[];
  sign: (episodeId: string, input: SignConsentInput) => Consent;
  reset: (seed?: SeedData) => void;
}

export const useConsentStore = createDomainStore<ConsentState>("consents", (set) => ({
  consents: seedSlice("consents"),
  sign: (episodeId, input) => {
    assert(input.signatureDataUrl.startsWith("data:image"), "Please sign in the box before saving", "signatureDataUrl");
    const consent = validate(consentSchema, {
      id: newId("CON"),
      episodeId,
      template: input.template,
      version: input.version,
      signerName: input.signerName.trim(),
      witnessName: input.witnessName?.trim() || undefined,
      signatureDataUrl: input.signatureDataUrl,
      signedAt: nowIso(),
      expiresAt: input.validityMonths ? shiftDate(todayIso(), Math.round(input.validityMonths * 30.4)) : undefined,
    });
    set((s) => {
      s.consents.push(consent);
    });
    audit("sign", "consent", `Signed ${consent.template} consent (${consent.version})`, episodeId);
    return consent;
  },
  reset: (seed = getSeed()) =>
    set((s) => {
      s.consents = seed.consents;
    }),
}));

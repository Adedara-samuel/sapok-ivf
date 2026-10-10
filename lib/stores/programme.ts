import {
  donorEligibility,
  donorSchema,
  surrogateEligibility,
  surrogateSchema,
  type Donor,
  type Surrogate,
} from "@/lib/schemas/programme";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { assert, createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { todayIso } from "@/lib/utils/dates";

export interface ProgrammeState {
  donors: Donor[];
  surrogates: Surrogate[];
  updateDonorScreening: (id: string, screening: Donor["screening"]) => void;
  matchDonor: (donorId: string, episodeId: string, ivfNo: string) => void;
  releaseDonor: (donorId: string) => void;
  setDonorStatus: (donorId: string, status: Donor["status"]) => void;
  updateSurrogateScreening: (id: string, screening: Surrogate["screening"]) => void;
  matchSurrogate: (id: string, episodeId: string, ivfNo: string) => void;
  setSurrogateStatus: (id: string, status: Surrogate["status"]) => void;
  reset: (seed: SeedData) => void;
}

export const useProgrammeStore = createDomainStore<ProgrammeState>("programme", (set, get) => {
  const donor = (id: string): Donor => {
    const d = get().donors.find((x) => x.id === id);
    if (!d) throw new DomainError("Donor not found");
    return d;
  };
  const surrogate = (id: string): Surrogate => {
    const s = get().surrogates.find((x) => x.id === id);
    if (!s) throw new DomainError("Surrogate not found");
    return s;
  };
  const writeDonor = (next: Donor, label: string) =>
    set((s) => {
      const parsed = validate(donorSchema, { ...next, history: [...next.history, { at: todayIso(), label }] });
      s.donors[s.donors.findIndex((x) => x.id === next.id)] = parsed;
    });
  const writeSurrogate = (next: Surrogate, label: string) =>
    set((s) => {
      const parsed = validate(surrogateSchema, { ...next, history: [...next.history, { at: todayIso(), label }] });
      s.surrogates[s.surrogates.findIndex((x) => x.id === next.id)] = parsed;
    });
  return {
    donors: [],
    surrogates: [],
    updateDonorScreening: (id, screening) => {
      const d = donor(id);
      const next = { ...d, screening };
      const verdict = donorEligibility(next);
      if (d.status === "screening" && verdict === "eligible") next.status = "available";
      if (verdict === "ineligible" && d.status !== "retired") next.status = "retired";
      writeDonor(next, `Screening updated — ${verdict}`);
      audit("update", "donor", `Updated screening for ${d.code} (${verdict})`, id);
    },
    matchDonor: (donorId, episodeId, ivfNo) => {
      const d = donor(donorId);
      assert(d.status === "available", `${d.code} is not available for matching (status: ${d.status})`);
      assert(donorEligibility(d) === "eligible", `${d.code} has not completed screening`);
      assert(
        !get().donors.some((x) => x.matchedEpisodeId === episodeId && x.kind === d.kind && x.status !== "retired"),
        "This episode already has a matched donor of this type",
      );
      writeDonor({ ...d, status: "matched", matchedEpisodeId: episodeId }, `Matched to ${ivfNo}`);
      audit("update", "donor", `Matched ${d.code} to ${ivfNo}`, donorId);
    },
    releaseDonor: (donorId) => {
      const d = donor(donorId);
      assert(d.status === "matched", "Only matched donors can be released");
      writeDonor({ ...d, status: "available", matchedEpisodeId: undefined }, "Match released");
      audit("update", "donor", `Released match for ${d.code}`, donorId);
    },
    setDonorStatus: (donorId, status) => {
      const d = donor(donorId);
      if (status === "available")
        assert(donorEligibility(d) === "eligible", "Complete screening before making the donor available");
      writeDonor({ ...d, status }, `Status → ${status}`);
      audit("update", "donor", `${d.code} status → ${status}`, donorId);
    },
    updateSurrogateScreening: (id, screening) => {
      const s = surrogate(id);
      const next = {
        ...s,
        screening,
        legalSignedAt: screening.legal === "signed" && !s.legalSignedAt ? todayIso() : s.legalSignedAt,
      };
      const verdict = surrogateEligibility(next);
      if (s.status === "screening" && verdict === "eligible") next.status = "approved";
      writeSurrogate(next, `Screening updated — ${verdict}`);
      audit("update", "surrogate", `Updated screening for ${s.code} (${verdict})`, id);
    },
    matchSurrogate: (id, episodeId, ivfNo) => {
      const s = surrogate(id);
      assert(s.status === "approved", `${s.code} must be approved before matching (status: ${s.status})`);
      assert(
        surrogateEligibility(s) === "eligible",
        "All screening and the legal agreement must be complete before matching",
      );
      writeSurrogate({ ...s, status: "matched", matchedEpisodeId: episodeId }, `Matched to ${ivfNo}`);
      audit("update", "surrogate", `Matched ${s.code} to ${ivfNo}`, id);
    },
    setSurrogateStatus: (id, status) => {
      const s = surrogate(id);
      writeSurrogate({ ...s, status }, `Status → ${status}`);
      audit("update", "surrogate", `${s.code} status → ${status}`, id);
    },
    reset: (seed) =>
      set((s) => {
        s.donors = seed.donors;
        s.surrogates = seed.surrogates;
      }),
  };
});

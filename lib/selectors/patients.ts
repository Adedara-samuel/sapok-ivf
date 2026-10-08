import { STAGE_LABELS } from "@/lib/constants/clinical";
import type { Cycle } from "@/lib/schemas/cycle";
import type { Episode } from "@/lib/schemas/episode";
import type { Person } from "@/lib/schemas/person";
import type { Staff } from "@/lib/schemas/admin";
import { currentCycleFor, isActiveTreatmentCycle, isPatient, primaryEpisodeFor } from "@/lib/selectors/predicates";

export interface PatientRow {
  id: string;
  prn: string;
  ivfNo: string;
  name: string;
  partner: string;
  dob: string;
  category: Person["payer"]["category"];
  phone: string;
  episodeType: Episode["type"] | "—";
  stage: string;
  stageKey: Cycle["stage"] | "none";
  doctorId: string;
  doctor: string;
  status: Episode["status"] | "registered";
  branchId: string;
  closedAt?: string;
  hasActiveCycle: boolean;
}

export function patientRows(
  persons: readonly Person[],
  episodes: readonly Episode[],
  cycles: readonly Cycle[],
  staff: readonly Staff[],
): PatientRow[] {
  const personMap = new Map(persons.map((p) => [p.id, p]));
  const staffMap = new Map(staff.map((s) => [s.id, s.name]));
  const episodeMap = new Map(episodes.map((e) => [e.id, e]));
  return persons.filter(isPatient).map((p) => {
    const ep = primaryEpisodeFor(p.id, episodes);
    const cycle = ep ? currentCycleFor(ep.id, cycles) : undefined;
    const partner = ep?.partnerId ? personMap.get(ep.partnerId) : undefined;
    return {
      id: p.id,
      prn: p.prn,
      ivfNo: ep?.ivfNo ?? "—",
      name: `${p.firstName} ${p.lastName}`,
      partner: partner ? `${partner.firstName} ${partner.lastName}` : "—",
      dob: p.dob,
      category: p.payer.category,
      phone: p.phone,
      episodeType: ep?.type ?? "—",
      stage: cycle ? STAGE_LABELS[cycle.stage] : ep ? "Not started" : "—",
      stageKey: cycle?.stage ?? "none",
      doctorId: ep?.doctorId ?? "",
      doctor: ep ? (staffMap.get(ep.doctorId) ?? "—") : "—",
      status: ep?.status ?? "registered",
      branchId: p.branchId,
      closedAt: ep?.closedAt,
      hasActiveCycle: ep ? cycles.some((c) => c.episodeId === ep.id && isActiveTreatmentCycle(c, episodeMap)) : false,
    };
  });
}

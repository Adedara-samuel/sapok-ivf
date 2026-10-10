import type { Episode } from "@/lib/schemas/episode";
import type { Person } from "@/lib/schemas/person";

/** Everything a patient-file tab needs to know about whose file it is. */
export interface PatientCtx {
  patient: Person;
  partner?: Person;
  episode?: Episode;
  episodes: Episode[];
}

export function identifiersFor(ctx: PatientCtx): { label: string; value: string }[] {
  const p = ctx.patient;
  return [
    { label: "Patient", value: `${p.title ?? ""} ${p.firstName} ${p.lastName}`.trim() },
    { label: "PRN", value: p.prn },
    { label: "IVF no", value: ctx.episode?.ivfNo ?? "—" },
    { label: "DOB", value: p.dob.split("-").reverse().join("/") },
    { label: "Partner", value: ctx.partner ? `${ctx.partner.firstName} ${ctx.partner.lastName}` : "—" },
    { label: "Mobile", value: p.phone },
  ];
}

import { PREGNANT_OUTCOMES, type Cycle } from "@/lib/schemas/cycle";
import type { ClinicDb } from "@/lib/selectors/types";
import { ageYears } from "@/lib/utils/dates";
import { percent } from "@/lib/utils/money";

export type GroupBy = "ageBand" | "protocol" | "doctor" | "embryologist";

export interface RateRow {
  group: string;
  cycles: number;
  fertilisation: number;
  cleavage: number;
  blastocyst: number;
  implantation: number;
  clinicalPregnancy: number;
  liveBirth: number;
}

export function ageBand(age: number): string {
  if (age < 35) return "<35";
  if (age <= 37) return "35–37";
  if (age <= 40) return "38–40";
  return ">40";
}

interface CycleFacts {
  cycle: Cycle;
  group: string;
  mii: number;
  fertilised: number;
  cleaved: number;
  blasts: number;
  transferred: number;
  decided: boolean;
  pregnant: boolean;
  liveBirth: boolean;
}

export function successRates(
  db: Pick<ClinicDb, "cycles" | "episodes" | "persons" | "embryos" | "procedures" | "staff">,
  groupBy: GroupBy,
  range: { from?: string; to?: string } = {},
): RateRow[] {
  const episodes = new Map(db.episodes.map((e) => [e.id, e]));
  const persons = new Map(db.persons.map((p) => [p.id, p]));
  const staff = new Map(db.staff.map((s) => [s.id, s.name]));
  const facts: CycleFacts[] = db.cycles
    .filter(
      (c) =>
        (c.ocr || c.transferPlan) &&
        (!range.from || c.startDate >= range.from) &&
        (!range.to || c.startDate <= range.to),
    )
    .map((c) => {
      const ep = episodes.get(c.episodeId);
      const patient = ep ? persons.get(ep.patientId) : undefined;
      const embryos = db.embryos.filter((e) => e.cycleId === c.id);
      const ocr = db.procedures.find((p) => p.cycleId === c.id && p.type === "OCR");
      const group =
        groupBy === "ageBand"
          ? ageBand(patient ? ageYears(patient.dob, c.startDate) : 0)
          : groupBy === "protocol"
            ? c.protocol
            : groupBy === "doctor"
              ? (staff.get(ep?.doctorId ?? "") ?? "Unknown")
              : (staff.get(ocr?.embryologistId ?? "") ?? "Not recorded");
      const transferred = c.transferPlan?.embryoIds.length ?? 0;
      const decided = transferred > 0 && c.outcome !== "pending" && c.outcome !== "cancelled";
      return {
        cycle: c,
        group,
        mii: c.ocr?.mii ?? 0,
        fertilised: c.ocr?.fertilised ?? 0,
        cleaved: c.ocr ? embryos.filter((e) => e.day >= 2).length : 0,
        blasts: c.ocr ? embryos.filter((e) => e.day >= 5).length : 0,
        transferred: decided ? transferred : 0,
        decided,
        pregnant: decided && PREGNANT_OUTCOMES.includes(c.outcome),
        liveBirth: decided && c.outcome === "live-birth",
      };
    });
  const groups = [...new Set(facts.map((f) => f.group))].sort();
  return groups.map((g) => {
    const rows = facts.filter((f) => f.group === g);
    const s = (k: "mii" | "fertilised" | "cleaved" | "blasts" | "transferred") =>
      rows.reduce((acc, r) => acc + r[k], 0);
    const decided = rows.filter((r) => r.decided).length;
    const pregnant = rows.filter((r) => r.pregnant).length;
    return {
      group: g,
      cycles: rows.length,
      fertilisation: percent(s("fertilised"), s("mii")),
      cleavage: percent(s("cleaved"), s("fertilised")),
      blastocyst: percent(s("blasts"), s("fertilised")),
      implantation: percent(pregnant, s("transferred")),
      clinicalPregnancy: percent(pregnant, decided),
      liveBirth: percent(rows.filter((r) => r.liveBirth).length, decided),
    };
  });
}

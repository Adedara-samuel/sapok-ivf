import { catalogItem, DRUG_SEED, HMO_NAMES, CORPORATE_NAMES } from "@/lib/constants/catalog";
import { COMPLEXIONS, DEFAULT_CONSENT_TEMPLATES, DIAGNOSES } from "@/lib/constants/clinical";
import type {
  AuditAction,
  Charge,
  ConsentTemplate,
  Cycle,
  CycleOutcome,
  CycleProtocol,
  CycleStage,
  Embryo,
  Episode,
  EpisodeType,
  Order,
  OrderKind,
  Payment,
  PaymentMethod,
  PayerCategory,
  Person,
  PersonRole,
  Procedure,
  ProcedureType,
  StaffRequest,
  StoragePosition,
  StorageItemKind,
  WaitingStatus,
} from "@/lib/schemas";
import { GOBLETS, TANKS } from "@/lib/schemas/embryology";
import { ageYears, daysBetween, formatTime, lagosDateTime, shiftDate, todayIso } from "@/lib/utils/dates";
import { pad } from "@/lib/utils/ids";
import { gradeScore } from "@/lib/utils/embryo";
import { EYE_COLOURS, FEMALE_FIRST, HAIR_COLOURS, MALE_FIRST, PATIENT_ADDRESSES, SURNAMES } from "@/lib/seed/names";
import { createRng } from "@/lib/seed/rng";
import { signatureDataUrl } from "@/lib/seed/signature";
import { SEED_STAFF } from "@/lib/seed/staff";
import type { SeedData } from "@/lib/seed/types";
import { addWalletSeed } from "@/lib/seed/wallets";

export const SEED_NUMBER = 20261008;

interface CoupleSpec {
  f: { first: string; last: string; age: number; title?: Person["title"] };
  m: { first: string; last: string; age: number; title?: Person["title"] };
  type: EpisodeType;
  diagnosis: string[];
  doctorId: string;
  payer: PayerCategory;
  branchId: string;
  openedOffset: number;
  status?: Episode["status"];
}

interface Couple {
  female: Person;
  male: Person;
  episode: Episode;
}

const EMBRYOLOGISTS = ["S04", "S05"] as const;
const NURSES = ["S06", "S07", "S08"] as const;
const SURGEONS = ["S01", "S02"] as const;
const BLAST_GRADES = ["5AA", "4AA", "4AB", "4BA", "4BB", "3AB", "3BB", "3BC", "4BC"] as const;
const CLEAVAGE_GRADES = ["8-cell G1", "8-cell G2", "7-cell G2", "6-cell G2", "4-cell G3"] as const;

export function buildSeed(anchor: Date = new Date()): SeedData {
  const today = todayIso(anchor);
  const rng = createRng(SEED_NUMBER);
  const day = (n: number): string => shiftDate(today, n);
  const at = (n: number, time = "09:00"): string => lagosDateTime(day(n), time);
  const counters: Record<string, number> = {};
  const sid = (prefix: string, width = 5): string => {
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    return `${prefix}-${pad(counters[prefix], width)}`;
  };

  const data: SeedData = {
    anchor: today,
    staff: SEED_STAFF.map((s) => ({ ...s })),
    persons: [],
    episodes: [],
    cycles: [],
    notes: [],
    stimulation: [],
    vitals: [],
    histories: [],
    procedures: [],
    embryos: [],
    storage: [],
    cultureLogs: [],
    custody: [],
    orders: [],
    batches: [],
    movements: [],
    charges: [],
    payments: [],
    refunds: [],
    claims: [],
    donors: [],
    surrogates: [],
    counselling: [],
    consents: [],
    requests: [],
    audit: [],
    notifications: [],
    waiting: [],
    documents: [],
    wallets: [],
    ledger: [],
    settlements: [],
    walletMessages: [],
  };

  // ---------------------------------------------------------------- people
  const usedPhones = new Set<string>();
  const newPhone = (): string => {
    for (;;) {
      const p = `0${rng.pick(["7", "8", "9"])}${rng.pick(["0", "1"])}${pad(rng.int(0, 99_999_999), 8)}`;
      if (!usedPhones.has(p)) {
        usedPhones.add(p);
        return p;
      }
    }
  };
  const prnCounters: Record<string, number> = { "BR-01": 100 };
  const newPrn = (branchId: string): string => {
    prnCounters[branchId] = (prnCounters[branchId] ?? 100) + 1;
    return `PRN-${branchId.replace("-", "")}-${pad(prnCounters[branchId] ?? 0, 6)}`;
  };
  const dobForAge = (age: number): string => shiftDate(today, -(age * 365 + rng.int(20, 330)));
  const bloodGroup = (): NonNullable<Person["bloodGroup"]> =>
    rng.pick(["O+", "O+", "O+", "A+", "A+", "B+", "B+", "AB+", "O-", "A-"] as const);
  const genotype = (): NonNullable<Person["genotype"]> => rng.pick(["AA", "AA", "AA", "AS", "AS", "AC"] as const);

  function makePerson(o: {
    first: string;
    last: string;
    sex: "F" | "M";
    age: number;
    roles: PersonRole[];
    branchId: string;
    payer: Person["payer"];
    createdOffset: number;
    title?: Person["title"];
    address?: { street: string; city: string; state: string };
    nokName?: string;
    nokRelationship?: string;
  }): Person {
    const addr = o.address ?? rng.pick(PATIENT_ADDRESSES);
    const person: Person = {
      id: sid("PT", 4),
      prn: newPrn(o.branchId),
      title: o.title ?? (o.sex === "F" ? "Mrs" : "Mr"),
      firstName: o.first,
      lastName: o.last,
      sex: o.sex,
      dob: dobForAge(o.age),
      maritalStatus:
        o.roles.includes("donor") || o.roles.includes("surrogate")
          ? rng.pick(["single", "married"] as const)
          : "married",
      phone: newPhone(),
      email: `${o.first.toLowerCase()}.${o.last.toLowerCase()}@example.ng`,
      address: `${rng.int(2, 88)} ${addr.street}`,
      city: addr.city,
      state: addr.state,
      nextOfKin: {
        name: o.nokName ?? `${rng.pick(o.sex === "F" ? MALE_FIRST : FEMALE_FIRST)} ${o.last}`,
        phone: newPhone(),
        relationship: o.nokRelationship ?? (o.sex === "F" ? "Husband" : "Wife"),
      },
      payer: o.payer,
      bloodGroup: bloodGroup(),
      genotype: genotype(),
      allergies: rng.chance(0.12) ? [rng.pick(["Penicillin", "Sulfonamides", "Latex", "Ibuprofen"] as const)] : [],
      roles: o.roles,
      branchId: o.branchId,
      createdAt: at(o.createdOffset, "08:30"),
    };
    data.persons.push(person);
    return person;
  }

  function payerFor(category: PayerCategory): Person["payer"] {
    if (category === "hmo")
      return { category, sponsor: rng.pick(HMO_NAMES), memberId: `HMO-${rng.int(100000, 999999)}` };
    if (category === "corporate")
      return { category, company: rng.pick(CORPORATE_NAMES), memberId: `EMP-${rng.int(1000, 9999)}` };
    if (category === "referral")
      return {
        category,
        sponsor: rng.pick(["Dr. A. Coker (St. Nicholas)", "Reddington Hospital", "Federal Medical Centre"]),
      };
    return { category };
  }

  let ivfCounter = 0;
  function makeCouple(spec: CoupleSpec): Couple {
    const payer = payerFor(spec.payer);
    const female = makePerson({
      ...spec.f,
      sex: "F",
      roles: ["patient"],
      branchId: spec.branchId,
      payer,
      createdOffset: spec.openedOffset,
      title: spec.f.title,
    });
    const male = makePerson({
      ...spec.m,
      sex: "M",
      roles: ["partner"],
      branchId: spec.branchId,
      payer,
      createdOffset: spec.openedOffset,
      title: spec.m.title,
      address: { street: female.address.replace(/^\d+ /, ""), city: female.city, state: female.state },
      nokName: `${female.firstName} ${female.lastName}`,
    });
    male.address = female.address;
    female.nextOfKin = { name: `${male.firstName} ${male.lastName}`, phone: male.phone, relationship: "Husband" };
    male.nextOfKin = { name: `${female.firstName} ${female.lastName}`, phone: female.phone, relationship: "Wife" };
    ivfCounter += 1;
    const episode: Episode = {
      id: sid("EP", 4),
      ivfNo: `IVF-2026-${pad(ivfCounter, 4)}`,
      patientId: female.id,
      partnerId: male.id,
      type: spec.type,
      doctorId: spec.doctorId,
      status: spec.status ?? "open",
      diagnosis: spec.diagnosis,
      openedAt: day(spec.openedOffset),
      branchId: spec.branchId,
    };
    data.episodes.push(episode);
    return { female, male, episode };
  }

  // ---------------------------------------------------------------- clinical helpers
  function makeCycle(ep: Episode, c: Omit<Cycle, "id" | "episodeId">): Cycle {
    const cycle: Cycle = { id: sid("CY", 4), episodeId: ep.id, ...c };
    data.cycles.push(cycle);
    return cycle;
  }

  function note(
    ep: Episode,
    kind: "doctor" | "nurse" | "counselling",
    offset: number,
    time: string,
    body: string,
    authorId?: string,
  ): void {
    data.notes.push({
      id: sid("NT"),
      episodeId: ep.id,
      kind,
      body,
      authorId: authorId ?? (kind === "doctor" ? ep.doctorId : kind === "nurse" ? rng.pick(NURSES) : "S09"),
      createdAt: at(offset, time),
    });
  }

  function vitalsAround(
    ep: Episode,
    offset: number,
    time: string,
    override?: { phase: "pre-op" | "post-op"; spo2?: number; bpSys?: number; bpDia?: number },
  ): void {
    const [h, m] = time.split(":").map(Number);
    const pre = `${pad(Math.max(6, (h ?? 9) - 1), 2)}:${pad(m ?? 0, 2)}`;
    const post = `${pad(Math.min(20, (h ?? 9) + 1), 2)}:${pad(m ?? 0, 2)}`;
    (["pre-op", "post-op"] as const).forEach((phase) => {
      const o = override?.phase === phase ? override : undefined;
      data.vitals.push({
        id: sid("VT"),
        episodeId: ep.id,
        phase,
        at: at(offset, phase === "pre-op" ? pre : post),
        pulse: rng.int(68, 92),
        resp: rng.int(14, 18),
        bpSys: o?.bpSys ?? rng.int(104, 128),
        bpDia: o?.bpDia ?? rng.int(64, 82),
        tempC: rng.float(36.4, 37.1),
        spo2: o?.spo2 ?? rng.int(97, 99),
        postedBy: rng.pick(NURSES),
      });
    });
  }

  function procedure(
    cycle: Cycle,
    type: ProcedureType,
    offset: number,
    time: string,
    extra: Partial<Procedure> & { postOpNote: string },
  ): Procedure {
    const surgeonId = extra.surgeonId ?? (type === "ANDROLOGY" || type === "BIOPSY" ? "S03" : rng.pick(SURGEONS));
    const posted = offset <= 0 && extra.status !== "draft";
    const p: Procedure = {
      id: sid("PR"),
      cycleId: cycle.id,
      type,
      date: day(offset),
      time,
      surgeonId,
      embryologistId: extra.embryologistId,
      scrubNurseId: extra.scrubNurseId ?? (type === "PGT" || type === "ANDROLOGY" ? undefined : "S06"),
      count: extra.count,
      embryoGrade: extra.embryoGrade,
      embryosTransferred: extra.embryosTransferred,
      postOpNote: extra.postOpNote,
      status: posted ? "posted" : "draft",
      signatureDataUrl: posted ? signatureDataUrl(surgeonId, rng) : undefined,
      signedAt: posted ? at(offset, time) : undefined,
      addenda: [],
    };
    data.procedures.push(p);
    return p;
  }

  function stimSeries(
    cycle: Cycle,
    o: {
      startOffset: number;
      scanDays: number[];
      finalDay: number;
      right: number[];
      left: number[];
      endoFinal: number;
      e2Final: number;
      drugs: { drug: string; dose: string }[];
      lastRemark?: string;
      nextScanOffset?: number;
      postedBy: string;
    },
  ): void {
    o.scanDays.forEach((sd, idx) => {
      const offset = o.startOffset + sd - 1;
      const gap = o.finalDay - sd;
      const grow = (list: number[]): number[] =>
        sd === 1 ? [] : list.map((f) => Math.round(f - gap * rng.float(1.5, 2))).filter((f) => f >= 5);
      const isLast = idx === o.scanDays.length - 1;
      const ratio = sd / o.finalDay;
      data.stimulation.push({
        id: sid("ST"),
        cycleId: cycle.id,
        date: day(offset),
        scanDay: sd === 1 ? "D2 baseline scan" : `D${sd} follicular scan`,
        injections: sd === 1 ? o.drugs.slice(0, 1) : o.drugs,
        endometriumMm: Math.round((5.2 + (o.endoFinal - 5.2) * ratio) * 10) / 10,
        follicles: { right: grow(o.right), left: grow(o.left) },
        e2: sd === 1 ? rng.int(30, 55) : Math.round(o.e2Final * ratio ** 2.4),
        lh: rng.float(1.5, 5.5),
        progesterone: rng.float(0.3, 0.9),
        remark:
          isLast && o.lastRemark
            ? o.lastRemark
            : sd === 1
              ? `Baseline AFC ${cycle.afc ?? 10}; ovaries quiet. Start stimulation.`
              : `Satisfactory response; for D${sd + 2} follicular scan.`,
        nextScan: isLast
          ? o.nextScanOffset !== undefined
            ? day(o.nextScanOffset)
            : undefined
          : day(o.startOffset + (o.scanDays[idx + 1] ?? sd) - 1),
        postedBy: o.postedBy,
      });
    });
  }

  function cultureLog(cycle: Cycle, ocrOffset: number, upToDay: number, by: string): void {
    const lines = [
      "Oocytes denuded; MII assessed; ICSI/IVF performed. Dish to K-System incubator.",
      "Fertilisation check 16–18 h: 2PN zygotes recorded.",
      "D2 cleavage assessment: majority 4-cell, minimal fragmentation.",
      "D3 assessment: 8-cell embryos; media change to blastocyst medium.",
      "D4 morula check: compaction in progress.",
      "D5 blastocyst grading (Gardner). Selection for transfer/vitrification.",
      "D6 late blastocyst assessment; remaining viable blastocysts vitrified.",
    ];
    for (let d = 0; d <= upToDay && d <= 6; d += 1) {
      data.cultureLogs.push({
        id: sid("CL"),
        cycleId: cycle.id,
        date: day(ocrOffset + d),
        day: d,
        note: lines[d] ?? "Culture check.",
        incubator: rng.pick(["Incubator A (Geri 1)", "Incubator B (K-System)"]),
        by,
      });
    }
  }

  function addEmbryos(
    cycle: Cycle,
    defs: { day: number; grade?: string; status: Embryo["status"]; pgt?: Embryo["pgtResult"] }[],
    source: Embryo["source"] = "own",
  ): Embryo[] {
    return defs.map((d, i) => {
      const e: Embryo = {
        id: sid("EMB"),
        cycleId: cycle.id,
        label: `C${cycle.number}-E${i + 1}`,
        source,
        day: d.day,
        stage:
          d.day >= 5
            ? d.day === 6
              ? "Expanded blastocyst"
              : "Blastocyst"
            : d.day === 0
              ? "Oocyte (MII)"
              : d.day === 1
                ? "2PN zygote"
                : d.day === 3
                  ? "8-cell"
                  : d.day === 4
                    ? "Morula"
                    : "4-cell",
        grade: d.grade,
        pgtResult: d.pgt ?? "not-tested",
        status: d.status,
      };
      data.embryos.push(e);
      return e;
    });
  }

  function outcomeFor(age: number, transferOffset: number): CycleOutcome {
    if (transferOffset > -12) return "pending";
    const p = age < 35 ? 0.52 : age < 40 ? 0.38 : 0.2;
    const r = rng.next();
    if (r < p) {
      if (rng.chance(0.15)) return "miscarriage";
      if (transferOffset < -270) return "live-birth";
      if (transferOffset < -56) return "ongoing";
      return "clinical-pregnancy";
    }
    if (r < p + 0.07) return "biochemical";
    return "negative";
  }

  /** A complete fresh cycle in the past (OCR + culture + transfer + outcome). */
  function simulateFresh(couple: Couple, cycle: Cycle, ocrOffset: number, opts: { freezeAll?: boolean } = {}): void {
    const ep = couple.episode;
    const age = ageYears(couple.female.dob, day(ocrOffset));
    const eggs = Math.max(3, rng.int(5, 16) - (age >= 40 ? 5 : age >= 36 ? 2 : 0));
    const mii = Math.max(2, Math.round(eggs * rng.float(0.7, 0.9, 2)));
    const fert = Math.max(1, Math.round(mii * rng.float(0.65, 0.88, 2)));
    cycle.ocr = { eggs, mii, fertilised: fert };
    cycle.trigger = { date: day(ocrOffset - 2), drug: "Choriogonadotropin alfa 250 mcg", time: "22:00" };
    const embryologistId = rng.pick(EMBRYOLOGISTS);
    procedure(cycle, "OCR", ocrOffset, "08:30", {
      count: eggs,
      embryologistId,
      postOpNote: `TVS-guided OCR under IV sedation. ${eggs} COCs retrieved (${mii} MII). Minimal blood loss; stable post-op.`,
    });
    vitalsAround(ep, ocrOffset, "08:30");
    const blastProb = age >= 40 ? 0.3 : age >= 36 ? 0.42 : 0.55;
    const defs: { day: number; grade?: string; status: Embryo["status"] }[] = [];
    for (let i = 0; i < fert; i += 1) {
      const d3 = rng.chance(0.85);
      const d5 = d3 && rng.chance(blastProb);
      defs.push(
        d5
          ? { day: rng.chance(0.2) ? 6 : 5, grade: rng.pick(BLAST_GRADES), status: "culturing" }
          : { day: d3 ? 3 : 2, grade: d3 ? rng.pick(CLEAVAGE_GRADES) : undefined, status: "arrested" },
      );
    }
    const embryos = addEmbryos(cycle, defs, ep.type === "DONOR-SPERM" ? "donor-sperm" : "own");
    const blasts = embryos.filter((e) => e.day >= 5).sort((a, b) => gradeScore(b.grade) - gradeScore(a.grade));
    cultureLog(cycle, ocrOffset, 5, embryologistId);
    if (blasts.length === 0) {
      cycle.stage = "cancelled";
      cycle.outcome = "cancelled";
      cycle.cancelReason = "No blastocyst available for transfer (developmental arrest).";
      return;
    }
    if (opts.freezeAll) {
      blasts.forEach((b) => (b.status = "cryopreserved"));
      cycle.stage = "completed";
      cycle.outcome = "pending";
      cycle.plan = "Freeze-all; plan FET in a subsequent cycle.";
      return;
    }
    const nTransfer = age >= 38 && blasts.length > 1 ? 2 : 1;
    const transferred = blasts.slice(0, nTransfer);
    transferred.forEach((b) => (b.status = "transferred"));
    blasts.slice(nTransfer).forEach((b) => (b.status = "cryopreserved"));
    const etOffset = ocrOffset + 5;
    cycle.transferPlan = { date: day(etOffset), embryoIds: transferred.map((b) => b.id) };
    procedure(cycle, "ET", etOffset, "11:00", {
      embryologistId,
      embryoGrade: transferred.map((b) => b.grade).join(", "),
      embryosTransferred: transferred.length,
      postOpNote: "Atraumatic transfer under TAS guidance. Catheter checked, no retained embryo.",
    });
    vitalsAround(ep, etOffset, "11:00");
    cycle.lutealSupport = "Progesterone in oil 100 mg IM daily + vaginal gel";
    cycle.outcome = outcomeFor(age, etOffset);
    cycle.betaHcg = {
      date: day(etOffset + 11),
      value: ["clinical-pregnancy", "ongoing", "live-birth", "miscarriage"].includes(cycle.outcome)
        ? rng.int(180, 950)
        : cycle.outcome === "biochemical"
          ? rng.int(26, 60)
          : rng.int(0, 4),
    };
    cycle.stage = cycle.outcome === "pending" ? "luteal" : "completed";
  }

  /** Frozen transfer using cryopreserved embryos from an earlier cycle of the same episode. */
  function simulateFet(couple: Couple, cycle: Cycle, etOffset: number, n = 1): boolean {
    const epCycleIds = data.cycles.filter((c) => c.episodeId === couple.episode.id).map((c) => c.id);
    const frozen = data.embryos
      .filter((e) => epCycleIds.includes(e.cycleId) && e.status === "cryopreserved")
      .slice(0, n);
    if (frozen.length === 0) return false;
    frozen.forEach((e) => (e.status = "transferred"));
    cycle.transferPlan = { date: day(etOffset), embryoIds: frozen.map((e) => e.id) };
    procedure(cycle, "FET", etOffset, "11:30", {
      embryologistId: rng.pick(EMBRYOLOGISTS),
      embryoGrade: frozen.map((e) => e.grade).join(", "),
      embryosTransferred: frozen.length,
      postOpNote: "Warmed blastocyst(s) survived 100%. Smooth transfer under ultrasound guidance.",
    });
    vitalsAround(couple.episode, etOffset, "11:30");
    cycle.lutealSupport = "Progesterone in oil 100 mg IM daily";
    cycle.outcome = outcomeFor(ageYears(couple.female.dob), etOffset);
    cycle.stage = cycle.outcome === "pending" ? "luteal" : "completed";
    cycle.betaHcg = {
      date: day(etOffset + 11),
      value: ["clinical-pregnancy", "ongoing", "live-birth", "miscarriage"].includes(cycle.outcome)
        ? rng.int(160, 900)
        : rng.int(0, 5),
    };
    return true;
  }

  // ---------------------------------------------------------------- orders & billing helpers
  const labText = (code: string, age: number): { text: string; abnormal: boolean } => {
    switch (code) {
      case "LAB-AMH": {
        const v = age >= 40 ? rng.float(0.2, 1.1, 2) : age >= 35 ? rng.float(0.8, 2.6, 2) : rng.float(1.5, 5.5, 2);
        return { text: `AMH ${v} ng/mL`, abnormal: v < 1 };
      }
      case "LAB-FSH": {
        const v = rng.float(4, 14);
        return { text: `FSH ${v} IU/L (D2)`, abnormal: v > 12.5 };
      }
      case "LAB-E2":
        return { text: `E2 ${rng.int(35, 70)} pg/mL (baseline)`, abnormal: false };
      case "LAB-PRL": {
        const v = rng.float(6, 28);
        return { text: `Prolactin ${v} ng/mL`, abnormal: v > 23.3 };
      }
      case "LAB-TSH": {
        const v = rng.float(0.8, 3.2);
        return { text: `TSH ${v} mIU/L`, abnormal: v > 2.5 };
      }
      case "LAB-SA": {
        const c = rng.int(3, 60);
        return {
          text: `Volume 2.8 mL; count ${c} M/mL; progressive motility ${rng.int(18, 55)}%; normal forms ${rng.int(2, 7)}%`,
          abnormal: c < 16,
        };
      }
      case "LAB-VIRAL":
        return { text: "HIV non-reactive; HBsAg non-reactive; HCV non-reactive; VDRL non-reactive", abnormal: false };
      case "LAB-BGG":
        return { text: `${bloodGroup()}, genotype ${genotype()}`, abnormal: false };
      case "LAB-FBC": {
        const hb = rng.float(10.4, 13.8);
        return { text: `Hb ${hb} g/dL; WBC ${rng.float(4.2, 8.8)}; Plt ${rng.int(180, 360)}`, abnormal: hb < 11.5 };
      }
      case "LAB-VITD": {
        const v = rng.int(14, 48);
        return { text: `25-OH Vitamin D ${v} ng/mL`, abnormal: v < 30 };
      }
      case "LAB-BHCG": {
        const v = rng.int(0, 600);
        return { text: `Beta-hCG ${v} IU/L`, abnormal: false };
      }
      case "RAD-BTVS":
        return {
          text: `Uterus normal size; ET ${rng.float(4.5, 6.5)} mm; AFC R${rng.int(3, 9)} L${rng.int(3, 9)}`,
          abnormal: false,
        };
      case "RAD-HSG":
        return {
          text: rng.chance(0.4)
            ? "Left tube blocked at cornual end; right tube patent with free spill"
            : "Bilateral tubal patency with free peritoneal spill",
          abnormal: false,
        };
      default:
        return { text: "Within reference range", abnormal: false };
    }
  };

  const DOSING: Record<string, { dosage: string; frequency: string; duration: string; qty: number }> = {
    "DRG-FOL300": { dosage: "225 IU SC", frequency: "nocte", duration: "10 days", qty: 3 },
    "DRG-FOL150": { dosage: "150 IU SC", frequency: "nocte", duration: "10 days", qty: 6 },
    "DRG-MENO150": { dosage: "150 IU SC", frequency: "nocte", duration: "8 days", qty: 6 },
    "DRG-CET": { dosage: "0.25 mg SC", frequency: "daily", duration: "5 days", qty: 5 },
    "DRG-GAN": { dosage: "0.25 mg SC", frequency: "daily", duration: "5 days", qty: 5 },
    "DRG-OVI": { dosage: "250 mcg SC", frequency: "stat", duration: "once", qty: 1 },
    "DRG-HCG": { dosage: "10,000 IU IM", frequency: "stat", duration: "once", qty: 2 },
    "DRG-PIO": { dosage: "100 mg IM", frequency: "daily", duration: "14 days", qty: 14 },
    "DRG-PGEL": { dosage: "90 mg PV", frequency: "daily", duration: "14 days", qty: 1 },
    "DRG-EV2": { dosage: "2 mg PO", frequency: "tds", duration: "14 days", qty: 2 },
    "DRG-LET": { dosage: "5 mg PO", frequency: "daily", duration: "D3–D7", qty: 1 },
    "DRG-CLO": { dosage: "100 mg PO", frequency: "daily", duration: "D2–D6", qty: 1 },
    "DRG-MET": { dosage: "500 mg PO", frequency: "bd", duration: "30 days", qty: 2 },
    "DRG-FA": { dosage: "5 mg PO", frequency: "daily", duration: "30 days", qty: 1 },
    "DRG-COQ": { dosage: "200 mg PO", frequency: "daily", duration: "30 days", qty: 1 },
    "DRG-ASP": { dosage: "75 mg PO", frequency: "daily", duration: "30 days", qty: 1 },
    "DRG-ENOX": { dosage: "40 mg SC", frequency: "daily", duration: "10 days", qty: 10 },
    "DRG-PRED": { dosage: "5 mg PO", frequency: "daily", duration: "14 days", qty: 1 },
    "DRG-DOXY": { dosage: "100 mg PO", frequency: "bd", duration: "5 days", qty: 1 },
    "DRG-CAB": { dosage: "0.5 mg PO", frequency: "daily", duration: "8 days", qty: 1 },
    "DRG-VD3": { dosage: "5000 IU PO", frequency: "daily", duration: "30 days", qty: 1 },
    "DRG-MPROG": { dosage: "200 mg PV", frequency: "tds", duration: "14 days", qty: 3 },
    "DRG-LEU": { dosage: "3.75 mg IM", frequency: "stat", duration: "once", qty: 1 },
    "DRG-TRIP": { dosage: "0.1 mg SC", frequency: "daily", duration: "14 days", qty: 14 },
  };

  function addOrder(couple: Couple, code: string, offset: number, o: Partial<Order> = {}): Order {
    const item = catalogItem(code);
    if (!item) throw new Error(`Unknown catalogue code ${code}`);
    const kind: OrderKind = item.kind === "drug" ? "pharmacy" : item.kind;
    const dosing = kind === "pharmacy" ? DOSING[code] : undefined;
    const qty = o.qty ?? dosing?.qty ?? 1;
    const past = offset < -1;
    const status: Order["status"] =
      o.status ??
      (kind === "pharmacy"
        ? past
          ? "dispensed"
          : "ordered"
        : kind === "service"
          ? "resulted"
          : past
            ? "resulted"
            : "ordered");
    const time = `${pad(rng.int(8, 15), 2)}:${pad(rng.pick([0, 15, 30, 45]), 2)}`;
    const result =
      (kind === "lab" || kind === "radiology") && status === "resulted"
        ? labText(code, ageYears(couple.female.dob))
        : undefined;
    const order: Order = {
      id: sid("ORD"),
      episodeId: couple.episode.id,
      kind,
      catalogCode: code,
      name: item.name,
      qty,
      unitPrice: item.price,
      amount: item.price * qty,
      status,
      dosage: dosing?.dosage,
      frequency: dosing?.frequency,
      duration: dosing?.duration,
      resultText: o.resultText ?? result?.text,
      abnormal: o.abnormal ?? result?.abnormal,
      critical: o.critical,
      resultedAt: status === "resulted" && kind !== "service" ? at(Math.min(0, offset + 1), "14:00") : undefined,
      cancelReason: o.cancelReason,
      dispensedAt: status === "dispensed" ? at(offset, "15:30") : undefined,
      dispensedBy: status === "dispensed" ? "S10" : undefined,
      orderedBy:
        kind === "pharmacy" || kind === "lab" || kind === "radiology"
          ? couple.episode.doctorId
          : rng.pick(["S16", "S17"]),
      at: at(offset, time),
    };
    data.orders.push(order);
    data.charges.push({
      id: sid("CHG"),
      episodeId: couple.episode.id,
      orderId: order.id,
      description: `${item.name}${qty > 1 ? ` × ${qty}` : ""}`,
      department: kind,
      amount: order.amount,
      paid: 0,
      payer: couple.female.payer.category,
      status: status === "cancelled" ? "waived" : "unpaid",
      at: order.at,
    });
    return order;
  }

  function consents(couple: Couple, templates: ConsentTemplate[], offset: number): void {
    templates.forEach((t) => {
      const tpl = DEFAULT_CONSENT_TEMPLATES.find((c) => c.id === t);
      const signer = couple.female;
      data.consents.push({
        id: sid("CON"),
        episodeId: couple.episode.id,
        template: t,
        version: tpl?.version ?? "v1.0",
        signerName: `${signer.firstName} ${signer.lastName} & ${couple.male.firstName} ${couple.male.lastName}`,
        witnessName: rng.pick(["Grace Otuyo", "Blessing Ede", "Folake Adeyemi"]),
        signatureDataUrl: signatureDataUrl(signer.lastName, rng),
        signedAt: at(offset, "10:15"),
        expiresAt: tpl?.validityMonths ? shiftDate(day(offset), 365) : undefined,
      });
    });
  }

  function addHistory(
    person: Person,
    extra: Partial<{ gynae: string; surgical: string; semen: string; para: number; miscarriages: number }> = {},
  ): void {
    data.histories.push({
      id: sid("MH", 4),
      personId: person.id,
      obstetric: {
        gravida: (extra.para ?? 0) + (extra.miscarriages ?? 0),
        para: extra.para ?? 0,
        living: extra.para ?? 0,
        miscarriages: extra.miscarriages ?? 0,
        ectopic: 0,
      },
      gynaecological:
        extra.gynae ?? `Menarche at ${rng.int(11, 15)}. Cycles ${rng.int(26, 32)}/${rng.int(4, 6)} days, regular.`,
      surgical: extra.surgical ?? "Nil significant.",
      medical: rng.chance(0.2) ? "Hypertension on amlodipine 5 mg daily." : "Nil chronic illness.",
      drugAllergy: person.allergies.length > 0 ? person.allergies.join(", ") : "No known drug allergies.",
      family: rng.chance(0.3) ? "Mother has type 2 diabetes." : "Nil significant.",
      semen: extra.semen ?? "Partner SFA: normozoospermia.",
      updatedAt: person.createdAt,
      updatedBy: "S01",
    });
  }

  // ================================================================ HAND-AUTHORED COUPLES (12)
  const hand: Couple[] = [];
  const H = (spec: CoupleSpec): Couple => {
    const c = makeCouple(spec);
    hand.push(c);
    return c;
  };

  // 1 — Adaobi & Chinedu Okafor: IVF cycle 2, stimulation day 8
  const c1 = H({
    f: { first: "Adaobi", last: "Okafor", age: 34 },
    m: { first: "Chinedu", last: "Okafor", age: 38, title: "Engr" },
    type: "IVF",
    diagnosis: ["Tubal factor"],
    doctorId: "S01",
    payer: "self-pay",
    branchId: "BR-01",
    openedOffset: -190,
  });
  const c1p = makeCycle(c1.episode, {
    number: 1,
    kind: "fresh",
    protocol: "antagonist",
    stage: "completed",
    startDate: day(-170),
    lmp: day(-171),
    outcome: "negative",
    amh: 2.4,
    afc: 14,
  });
  simulateFresh(c1, c1p, -158);
  c1p.outcome = "negative";
  c1p.stage = "completed";
  c1p.betaHcg = { date: day(-142), value: 2 };
  const c1c = makeCycle(c1.episode, {
    number: 2,
    kind: "fresh",
    protocol: "antagonist",
    stage: "stimulation",
    startDate: day(-8),
    lmp: day(-8),
    outcome: "pending",
    amh: 2.4,
    afc: 14,
    trigger: { date: day(3), drug: "Choriogonadotropin alfa 250 mcg", time: "22:00" },
  });
  stimSeries(c1c, {
    startOffset: -7,
    scanDays: [1, 5, 6, 8],
    finalDay: 8,
    right: [14, 12, 11, 10],
    left: [15, 13, 11, 9],
    endoFinal: 8.2,
    e2Final: 1450,
    drugs: [
      { drug: "Follitropin alfa 300 IU pen", dose: "225 IU" },
      { drug: "Cetrorelix 0.25 mg", dose: "0.25 mg" },
    ],
    lastRemark:
      "Good multifollicular response. Continue 225 IU + cetrorelix. For D10 follicular scan; plan trigger when ≥3 follicles ≥17 mm.",
    nextScanOffset: 2,
    postedBy: "S01",
  });
  const st1 = data.stimulation.filter((s) => s.cycleId === c1c.id);
  const lastSt1 = st1[st1.length - 1];
  if (lastSt1) {
    lastSt1.follicles = { right: [14, 12, 11, 10], left: [15, 13, 11, 9] };
    lastSt1.endometriumMm = 8.2;
    lastSt1.e2 = 1450;
  }
  addOrder(c1, "SVC-CONS", -190);
  addOrder(c1, "LAB-AMH", -188, { resultText: "AMH 2.4 ng/mL", abnormal: false });
  addOrder(c1, "RAD-HSG", -185, { resultText: "Bilateral hydrosalpinges; no free spill", abnormal: true });
  addOrder(c1, "SVC-IVF", -8);
  addOrder(c1, "DRG-FOL300", -7);
  addOrder(c1, "RAD-FTS", -3);
  addOrder(c1, "LAB-E2", -1, { resultText: "E2 1450 pg/mL (D8)", abnormal: false });
  addOrder(c1, "DRG-CET", 0);
  addOrder(c1, "DRG-OVI", 0);
  note(
    c1.episode,
    "doctor",
    -8,
    "09:10",
    "Came in on D1 of cycle 2 for commencement of IVF; consents signed; baseline scan endometrium 5.9 mm; AFC R7 L7. Start follitropin 225 IU nocte from D2.",
  );
  note(
    c1.episode,
    "nurse",
    -7,
    "10:00",
    "Injection technique taught; patient self-administered first dose under supervision. Sharps disposal explained.",
  );
  note(
    c1.episode,
    "doctor",
    -3,
    "09:40",
    "D5 scan: leading follicles 10/9 mm. E2 410. Continue same dose; add cetrorelix from D6.",
  );
  note(
    c1.episode,
    "doctor",
    0,
    "09:30",
    "D8 scan: R 14,12,11,10; L 15,13,11,9. ET 8.2 mm trilaminar. E2 1450. For D10 scan; trigger planned in 3 days.",
  );
  note(
    c1.episode,
    "nurse",
    0,
    "10:05",
    "Vitals stable. Cetrorelix and Ovitrelle prescribed; patient sent to pharmacy.",
  );
  consents(c1, ["ivf", "anaesthesia", "cryo-storage", "embryo-disposition"], -9);
  addHistory(c1.female, {
    gynae: "Regular cycles 28/5. Previous PID at age 24 (treated).",
    surgical: "Diagnostic laparoscopy 2024: bilateral hydrosalpinges.",
  });
  addHistory(c1.male, { semen: "SFA normozoospermia (count 48 M/mL, motility 52%)." });

  // 2 — Folasade & Kabiru Bello: ICSI cycle 1, D5 blastocysts today (OCR today-5, see DECISIONS)
  const c2 = H({
    f: { first: "Folasade", last: "Bello", age: 38 },
    m: { first: "Kabiru", last: "Bello", age: 41 },
    type: "ICSI",
    diagnosis: ["Male factor"],
    doctorId: "S02",
    payer: "hmo",
    branchId: "BR-01",
    openedOffset: -60,
  });
  const c2c = makeCycle(c2.episode, {
    number: 1,
    kind: "fresh",
    protocol: "antagonist",
    stage: "culture",
    startDate: day(-18),
    lmp: day(-18),
    outcome: "pending",
    amh: 1.6,
    afc: 11,
    trigger: { date: day(-7), drug: "Choriogonadotropin alfa 250 mcg", time: "22:00" },
    ocr: { eggs: 12, mii: 9, fertilised: 8 },
    lutealSupport: "Progesterone in oil 100 mg IM daily from OCR",
  });
  stimSeries(c2c, {
    startOffset: -17,
    scanDays: [1, 6, 8, 10],
    finalDay: 10,
    right: [19, 18, 17, 15, 13],
    left: [20, 18, 16, 14],
    endoFinal: 9.4,
    e2Final: 2650,
    drugs: [
      { drug: "Menotrophin 150 IU inj", dose: "225 IU" },
      { drug: "Cetrorelix 0.25 mg", dose: "0.25 mg" },
    ],
    lastRemark: "≥3 follicles ≥17 mm. Trigger tonight 22:00; OCR in 36 h.",
    postedBy: "S02",
  });
  procedure(c2c, "OCR", -5, "08:30", {
    count: 12,
    embryologistId: "S04",
    postOpNote: "TVS-guided OCR under IV sedation. 12 COCs retrieved, 9 MII. ICSI performed on 9 MII. Stable post-op.",
  });
  procedure(c2c, "ANDROLOGY", -5, "08:00", {
    count: 6,
    embryologistId: "S04",
    postOpNote: "Severe oligozoospermia (2.1 M/mL). Density gradient; 6 motile sperm selected for ICSI.",
    surgeonId: "S03",
  });
  vitalsAround(c2.episode, -5, "08:30", { phase: "post-op", spo2: 93 });
  const c2emb = addEmbryos(c2c, [
    { day: 5, grade: "4AA", status: "culturing" },
    { day: 5, grade: "4AB", status: "cryopreserved" },
    { day: 5, grade: "3BB", status: "cryopreserved" },
    { day: 3, grade: "8-cell G2", status: "arrested" },
    { day: 3, grade: "7-cell G2", status: "arrested" },
    { day: 3, grade: "6-cell G3", status: "arrested" },
    { day: 2, status: "arrested" },
    { day: 2, status: "arrested" },
  ]);
  c2c.transferPlan = { date: day(1), embryoIds: [c2emb[0]?.id ?? ""] };
  cultureLog(c2c, -5, 5, "S04");
  addOrder(c2, "SVC-CONS", -60);
  addOrder(c2, "LAB-SA", -58, {
    resultText: "Volume 2.1 mL; count 2.1 M/mL; progressive motility 12%; normal forms 1%",
    abnormal: true,
  });
  addOrder(c2, "LAB-SDF", -55, { resultText: "DNA fragmentation index 34%", abnormal: true });
  addOrder(c2, "SVC-IVF", -18);
  addOrder(c2, "SVC-ICSI", -18);
  addOrder(c2, "DRG-MENO150", -17);
  addOrder(c2, "DRG-CET", -12);
  addOrder(c2, "SVC-OCR", -5);
  addOrder(c2, "DRG-PIO", -5);
  addOrder(c2, "SVC-CRYO", 0);
  note(
    c2.episode,
    "doctor",
    -18,
    "09:00",
    "D2 of cycle; consents for ICSI signed. Baseline ET 5.1 mm, AFC 11. Start menotrophin 225 IU.",
  );
  note(
    c2.episode,
    "doctor",
    -7,
    "12:00",
    "D10: R 19,18,17 L 20,18. E2 2650. Trigger tonight 22:00 with Ovitrelle; OCR in 36 h.",
  );
  note(
    c2.episode,
    "nurse",
    -5,
    "10:30",
    "Post-OCR: SpO2 93% on room air at 10:20, rechecked 97% after 10 min on 2 L O2. Doctor informed. Discharged 13:00 stable.",
  );
  note(
    c2.episode,
    "doctor",
    -4,
    "09:00",
    "Embryology: 8/9 fertilised (2PN). Plan blastocyst culture; ET on D6 morning if lining adequate.",
  );
  note(
    c2.episode,
    "doctor",
    0,
    "11:30",
    "D5: 3 blastocysts (4AA, 4AB, 3BB). Vitrify 4AB and 3BB today; single 4AA transfer tomorrow.",
  );
  consents(c2, ["ivf", "icsi", "anaesthesia", "cryo-storage", "embryo-disposition"], -19);
  addHistory(c2.female, { gynae: "Regular cycles. No previous pregnancies." });
  addHistory(c2.male, { semen: "Severe oligoasthenozoospermia; DFI 34%. Varicocele repaired 2023." });

  // 3 — Ngozi & Ikenna Eke: donor oocyte recipient, endometrial prep day 10
  const c3 = H({
    f: { first: "Ngozi", last: "Eke", age: 41 },
    m: { first: "Ikenna", last: "Eke", age: 45, title: "Chief" },
    type: "DONOR-OOCYTE",
    diagnosis: ["Diminished ovarian reserve"],
    doctorId: "S01",
    payer: "corporate",
    branchId: "BR-01",
    openedOffset: -75,
  });
  const c3c = makeCycle(c3.episode, {
    number: 1,
    kind: "frozen",
    protocol: "fet-hrt",
    stage: "stimulation",
    startDate: day(-9),
    lmp: day(-10),
    outcome: "pending",
    amh: 0.3,
    afc: 2,
    plan: "Synchronise with donor DON-F-003 stimulation; fresh donor-oocyte ICSI with partner sperm.",
  });
  [1, 6, 10].forEach((sd, i) => {
    data.stimulation.push({
      id: sid("ST"),
      cycleId: c3c.id,
      date: day(-10 + sd),
      scanDay: sd === 1 ? "D1 baseline (HRT prep)" : `D${sd} endometrial scan`,
      injections: [{ drug: "Estradiol valerate 2 mg tabs", dose: sd < 6 ? "2 mg bd" : "2 mg tds" }],
      endometriumMm: [4.1, 6.4, 8.6][i],
      follicles: { right: [], left: [] },
      e2: [42, 210, 380][i],
      remark:
        i === 2
          ? "Trilaminar lining 8.6 mm. Continue E2; start progesterone once donor triggers."
          : "Continue estradiol valerate.",
      nextScan: i === 2 ? day(3) : undefined,
      postedBy: "S01",
    });
  });
  addOrder(c3, "SVC-CONS", -75);
  addOrder(c3, "LAB-AMH", -74, { resultText: "AMH 0.3 ng/mL", abnormal: true });
  addOrder(c3, "SVC-COUN", -70);
  addOrder(c3, "SVC-DONOR", -30);
  addOrder(c3, "DRG-EV2", -10);
  addOrder(c3, "RAD-FTS", 0);
  note(
    c3.episode,
    "doctor",
    -75,
    "10:00",
    "41-year-old with AMH 0.3, AFC 2; two failed cycles elsewhere. Counselled re donor oocyte programme.",
  );
  note(
    c3.episode,
    "counselling",
    -70,
    "11:00",
    "Donor anonymity, phenotype matching and legal parentage explained. Couple keen to proceed.",
    "S09",
  );
  note(
    c3.episode,
    "doctor",
    -30,
    "09:20",
    "Matched to donor DON-F-003 (O+, 1.68 m, medium brown complexion). Recipient HRT to start D1 of next cycle.",
  );
  note(c3.episode, "doctor", 0, "09:15", "HRT day 10: ET 8.6 mm trilaminar. Continue E2 valerate 2 mg tds.");
  consents(c3, ["ivf", "icsi", "donor", "cryo-storage", "embryo-disposition"], -31);
  addHistory(c3.female, {
    gynae: "Oligomenorrhoea for 2 years. Two failed IVF cycles (2024, 2025) — poor response.",
    para: 0,
  });

  // 4 — Hadiza & Aliyu Musa: FET HRT cycle 3; transfer today+2
  const c4 = H({
    f: { first: "Hadiza", last: "Musa", age: 32 },
    m: { first: "Aliyu", last: "Musa", age: 36 },
    type: "FET",
    diagnosis: ["Previous cycle surplus embryos", "PCOS"],
    doctorId: "S02",
    payer: "self-pay",
    branchId: "BR-01",
    openedOffset: -330,
  });
  const c4a = makeCycle(c4.episode, {
    number: 1,
    kind: "fresh",
    protocol: "antagonist",
    stage: "completed",
    startDate: day(-318),
    outcome: "negative",
    amh: 5.8,
    afc: 26,
  });
  procedure(c4a, "OCR", -305, "08:30", {
    count: 18,
    embryologistId: "S05",
    postOpNote: "18 COCs retrieved. Freeze-all due to OHSS risk.",
  });
  vitalsAround(c4.episode, -305, "08:30");
  c4a.ocr = { eggs: 18, mii: 15, fertilised: 12 };
  c4a.plan = "Freeze-all for OHSS risk.";
  const c4emb = addEmbryos(c4a, [
    { day: 5, grade: "4AA", status: "transferred" },
    { day: 5, grade: "4AB", status: "transferred" },
    { day: 5, grade: "4BB", status: "cryopreserved" },
    { day: 6, grade: "3BB", status: "cryopreserved" },
    { day: 5, grade: "4BC", status: "cryopreserved" },
    { day: 3, grade: "8-cell G2", status: "arrested" },
    { day: 3, grade: "6-cell G2", status: "arrested" },
  ]);
  cultureLog(c4a, -305, 6, "S05");
  const c4b = makeCycle(c4.episode, {
    number: 2,
    kind: "frozen",
    protocol: "fet-hrt",
    stage: "completed",
    startDate: day(-190),
    outcome: "biochemical",
    transferPlan: { date: day(-172), embryoIds: c4emb.slice(0, 2).map((e) => e.id) },
    betaHcg: { date: day(-161), value: 38 },
  });
  procedure(c4b, "FET", -172, "11:00", {
    embryologistId: "S05",
    embryoGrade: "4AA, 4AB",
    embryosTransferred: 2,
    postOpNote: "Two blastocysts (4AA, 4AB) warmed (100% survival) and transferred.",
  });
  vitalsAround(c4.episode, -172, "11:00");
  const c4c = makeCycle(c4.episode, {
    number: 3,
    kind: "frozen",
    protocol: "fet-hrt",
    stage: "transfer",
    startDate: day(-15),
    lmp: day(-16),
    outcome: "pending",
    transferPlan: { date: day(2), embryoIds: [c4emb[2]?.id ?? "", c4emb[3]?.id ?? ""] },
    lutealSupport: "Progesterone in oil 100 mg IM daily from P0 (today-3) + vaginal gel",
  });
  [1, 8, 13].forEach((sd, i) => {
    data.stimulation.push({
      id: sid("ST"),
      cycleId: c4c.id,
      date: day(-16 + sd),
      scanDay: sd === 1 ? "D1 baseline (HRT prep)" : `D${sd} endometrial scan`,
      injections: [{ drug: "Estradiol valerate 2 mg tabs", dose: "2 mg tds" }],
      endometriumMm: [4.3, 7.4, 9.1][i],
      follicles: { right: [], left: [] },
      e2: [38, 260, 410][i],
      progesterone: [0.4, 0.5, 0.6][i],
      remark:
        i === 2 ? "ET 9.1 mm triple-line. Start progesterone; FET of 2 blastocysts on P+5." : "Continue estradiol.",
      nextScan: undefined,
      postedBy: "S02",
    });
  });
  addOrder(c4, "SVC-FET", -15);
  addOrder(c4, "DRG-EV2", -15);
  addOrder(c4, "DRG-PIO", -3);
  addOrder(c4, "DRG-PGEL", -3);
  addOrder(c4, "SVC-STOR", -40);
  note(
    c4.episode,
    "doctor",
    -16,
    "09:00",
    "FET cycle 3 (HRT). Baseline ET 4.3 mm, ovaries quiet. Start E2 valerate 2 mg tds.",
  );
  note(
    c4.episode,
    "doctor",
    -3,
    "09:30",
    "ET 9.1 mm. Start PIO 100 mg daily (P0). Plan thaw of 2 blastocysts (4BB, 3BB) for FET in 5 days.",
  );
  note(
    c4.episode,
    "nurse",
    -3,
    "10:00",
    "IM progesterone technique demonstrated to husband. Next appointment: FET day.",
  );
  consents(c4, ["ivf", "cryo-storage", "embryo-disposition"], -320);
  addHistory(c4.female, { gynae: "PCOS; oligomenorrhoea; on metformin.", para: 0, miscarriages: 1 });

  // 5 — Efe & Tega Oghene: IVF cycle 1, ET today-9, beta-hCG today+1
  const c5 = H({
    f: { first: "Efe", last: "Oghene", age: 36 },
    m: { first: "Tega", last: "Oghene", age: 40 },
    type: "IVF",
    diagnosis: ["Unexplained"],
    doctorId: "S01",
    payer: "self-pay",
    branchId: "BR-01",
    openedOffset: -70,
  });
  const c5c = makeCycle(c5.episode, {
    number: 1,
    kind: "fresh",
    protocol: "antagonist",
    stage: "luteal",
    startDate: day(-27),
    outcome: "pending",
    amh: 2.1,
    afc: 12,
    trigger: { date: day(-16), drug: "Choriogonadotropin alfa 250 mcg", time: "22:00" },
    ocr: { eggs: 10, mii: 8, fertilised: 6 },
    lutealSupport: "Progesterone in oil 100 mg IM daily + vaginal gel",
    betaHcg: { date: day(1) },
  });
  stimSeries(c5c, {
    startOffset: -26,
    scanDays: [1, 6, 9, 11],
    finalDay: 11,
    right: [19, 17, 16],
    left: [18, 17, 14, 12],
    endoFinal: 9.8,
    e2Final: 2100,
    drugs: [
      { drug: "Follitropin alfa 300 IU pen", dose: "225 IU" },
      { drug: "Ganirelix 0.25 mg", dose: "0.25 mg" },
    ],
    lastRemark: "Trigger tonight.",
    postedBy: "S01",
  });
  procedure(c5c, "OCR", -14, "08:30", {
    count: 10,
    embryologistId: "S05",
    postOpNote: "10 COCs retrieved (8 MII). Conventional IVF. Stable.",
  });
  vitalsAround(c5.episode, -14, "08:30");
  const c5emb = addEmbryos(c5c, [
    { day: 5, grade: "4AB", status: "transferred" },
    { day: 5, grade: "4BB", status: "cryopreserved" },
    { day: 6, grade: "3BB", status: "cryopreserved" },
    { day: 3, grade: "8-cell G2", status: "arrested" },
    { day: 3, grade: "6-cell G2", status: "arrested" },
    { day: 2, status: "arrested" },
  ]);
  cultureLog(c5c, -14, 6, "S05");
  c5c.transferPlan = { date: day(-9), embryoIds: [c5emb[0]?.id ?? ""] };
  procedure(c5c, "ET", -9, "11:00", {
    embryologistId: "S05",
    embryoGrade: "4AB",
    embryosTransferred: 1,
    postOpNote: "Single 4AB blastocyst transferred under TAS guidance. Atraumatic.",
  });
  vitalsAround(c5.episode, -9, "11:00", { phase: "pre-op", bpSys: 150, bpDia: 95 });
  addOrder(c5, "SVC-CONS", -70);
  addOrder(c5, "SVC-IVF", -27);
  addOrder(c5, "DRG-FOL300", -26);
  addOrder(c5, "DRG-GAN", -21);
  addOrder(c5, "SVC-ET", -9);
  addOrder(c5, "DRG-PIO", -14);
  addOrder(c5, "LAB-BHCG", 0, { status: "ordered" });
  note(c5.episode, "doctor", -14, "12:00", "OCR: 10 eggs, 8 MII. IVF insemination. Start luteal support tonight.");
  note(c5.episode, "nurse", -9, "10:20", "Pre-ET BP 150/95 — repeated after rest 132/84. Doctor aware, proceeded.");
  note(c5.episode, "doctor", -9, "11:40", "ET: single 4AB blastocyst. 2 blastocysts vitrified. Beta-hCG in 10 days.");
  note(
    c5.episode,
    "nurse",
    0,
    "09:00",
    "Phone call: no bleeding, mild cramps. Reminded of beta-hCG tomorrow 8am fasting not required.",
  );
  consents(c5, ["ivf", "anaesthesia", "cryo-storage", "embryo-disposition"], -28);
  addHistory(c5.female);

  // 6 — Blessing & Obinna Nwachukwu: IUI cycle 2, IUI planned today+1
  const c6 = H({
    f: { first: "Blessing", last: "Nwachukwu", age: 29, title: "Mrs" },
    m: { first: "Obinna", last: "Nwachukwu", age: 33 },
    type: "IUI",
    diagnosis: ["PCOS"],
    doctorId: "S02",
    payer: "hmo",
    branchId: "BR-01",
    openedOffset: -120,
  });
  const c6a = makeCycle(c6.episode, {
    number: 1,
    kind: "fresh",
    protocol: "mild",
    stage: "completed",
    startDate: day(-95),
    outcome: "negative",
    afc: 24,
    betaHcg: { date: day(-66), value: 1 },
  });
  procedure(c6a, "ANDROLOGY", -80, "09:00", {
    count: 18,
    embryologistId: "S05",
    surgeonId: "S03",
    postOpNote: "Density-gradient prep; post-wash 18 M motile. IUI performed.",
  });
  const c6c = makeCycle(c6.episode, {
    number: 2,
    kind: "fresh",
    protocol: "mild",
    stage: "trigger",
    startDate: day(-12),
    lmp: day(-13),
    outcome: "pending",
    afc: 22,
    trigger: { date: day(0), drug: "hCG 5000 IU", time: "21:00" },
    plan: "IUI planned 36 h post-trigger (tomorrow).",
  });
  [1, 10, 12].forEach((sd, i) => {
    data.stimulation.push({
      id: sid("ST"),
      cycleId: c6c.id,
      date: day(-13 + sd),
      scanDay: sd === 1 ? "D2 baseline scan" : `D${sd} follicular scan`,
      injections: i === 0 ? [{ drug: "Letrozole 2.5 mg", dose: "5 mg D3–7" }] : [],
      endometriumMm: [5.0, 7.8, 8.9][i],
      follicles: { right: i === 0 ? [] : i === 1 ? [16] : [19], left: i === 0 ? [] : i === 1 ? [12] : [13] },
      e2: [40, 260, 340][i],
      lh: [3.2, 6.1, 9.4][i],
      remark:
        i === 2
          ? "Lead follicle 19 mm right. hCG trigger tonight 21:00; IUI in 36 h."
          : i === 1
            ? "Letrozole D3–7 completed. For repeat scan in 2 days."
            : "Baseline normal. Letrozole 5 mg D3–7.",
      nextScan: i === 1 ? day(-1) : undefined,
      postedBy: "S02",
    });
  });
  addOrder(c6, "SVC-IUI", -95);
  addOrder(c6, "DRG-LET", -95);
  addOrder(c6, "SVC-IUI", -12);
  addOrder(c6, "DRG-LET", -11);
  addOrder(c6, "RAD-FTS", -1);
  addOrder(c6, "DRG-HCG", 0);
  note(c6.episode, "doctor", -12, "09:00", "IUI cycle 2. Letrozole 5 mg D3–D7. Scan D10.");
  note(
    c6.episode,
    "doctor",
    -1,
    "10:30",
    "Lead follicle 19 mm (R). ET 8.9 mm. hCG 5000 IU ×2 trigger tomorrow night; IUI 36 h later.",
  );
  note(c6.episode, "nurse", 0, "09:30", "Partner reminded: abstain 2–5 days; semen sample at 08:00 on IUI day.");
  consents(c6, ["ivf"], -96);
  addHistory(c6.female, { gynae: "PCOS (Rotterdam). Cycles 35–60 days. BMI 29." });

  // 7 — Amaka & Sunday Duru: surrogacy, SUR-002 matched
  const c7 = H({
    f: { first: "Amaka", last: "Duru", age: 44 },
    m: { first: "Sunday", last: "Duru", age: 47 },
    type: "SURROGACY",
    diagnosis: ["Uterine factor", "Absent uterus (MRKH)"],
    doctorId: "S01",
    payer: "corporate",
    branchId: "BR-01",
    openedOffset: -160,
  });
  const c7a = makeCycle(c7.episode, {
    number: 1,
    kind: "fresh",
    protocol: "antagonist",
    stage: "completed",
    startDate: day(-110),
    outcome: "pending",
    amh: 1.1,
    afc: 8,
  });
  simulateFresh(c7, c7a, -98, { freezeAll: true });
  if (data.embryos.filter((e) => e.cycleId === c7a.id && e.status === "cryopreserved").length < 2) {
    addEmbryos(c7a, [
      { day: 5, grade: "4AB", status: "cryopreserved" },
      { day: 5, grade: "4BB", status: "cryopreserved" },
    ]);
  }
  c7a.plan = "Freeze-all; embryos for transfer to gestational carrier SUR-002.";
  c7a.stage = "completed";
  c7a.outcome = "pending";
  c7a.cancelReason = undefined;
  makeCycle(c7.episode, {
    number: 2,
    kind: "frozen",
    protocol: "fet-hrt",
    stage: "baseline",
    startDate: day(9),
    outcome: "pending",
    plan: "Surrogate SUR-002 HRT prep; single euploid-equivalent blastocyst transfer.",
  });
  addOrder(c7, "SVC-SURR", -60);
  addOrder(c7, "SVC-IVF", -110);
  addOrder(c7, "SVC-CRYO", -93);
  note(
    c7.episode,
    "doctor",
    -160,
    "10:00",
    "MRKH syndrome — functioning ovaries, absent uterus. Plan IVF with gestational surrogacy.",
  );
  note(c7.episode, "counselling", -150, "11:30", "Surrogacy pathway, legal agreement and costs explained.", "S09");
  note(
    c7.episode,
    "doctor",
    -30,
    "09:00",
    "Surrogate SUR-002 matched and medically cleared. Legal agreement signed. Plan ET into surrogate next cycle.",
  );
  consents(c7, ["ivf", "surrogacy", "cryo-storage", "embryo-disposition", "anaesthesia"], -112);
  addHistory(c7.female, { gynae: "Primary amenorrhoea; MRKH confirmed on MRI 2010." });

  // 8 — Rukayat & Taiwo Adeniyi: closed, live birth today-40
  const c8 = H({
    f: { first: "Rukayat", last: "Adeniyi", age: 35 },
    m: { first: "Taiwo", last: "Adeniyi", age: 39 },
    type: "FET",
    diagnosis: ["Tubal factor"],
    doctorId: "S02",
    payer: "self-pay",
    branchId: "BR-01",
    openedOffset: -480,
    status: "closed",
  });
  const c8a = makeCycle(c8.episode, {
    number: 1,
    kind: "fresh",
    protocol: "long-agonist",
    stage: "completed",
    startDate: day(-460),
    outcome: "negative",
    amh: 3.0,
    afc: 15,
  });
  simulateFresh(c8, c8a, -440);
  c8a.outcome = "negative";
  c8a.stage = "completed";
  if (data.embryos.filter((e) => e.cycleId === c8a.id && e.status === "cryopreserved").length === 0)
    addEmbryos(c8a, [{ day: 5, grade: "4AB", status: "cryopreserved" }]);
  const c8b = makeCycle(c8.episode, {
    number: 2,
    kind: "frozen",
    protocol: "fet-hrt",
    stage: "completed",
    startDate: day(-330),
    outcome: "pending",
  });
  simulateFet(c8, c8b, -312);
  c8b.outcome = "live-birth";
  c8b.stage = "completed";
  c8b.betaHcg = { date: day(-301), value: 612 };
  c8.episode.closedAt = day(-40);
  c8.episode.closeReason = "live-birth";
  c8.episode.closeNote = "Live birth of healthy female infant (3.1 kg) by C-section at 38 weeks.";
  addOrder(c8, "SVC-FET", -330);
  addOrder(c8, "SVC-ET", -312);
  addOrder(c8, "LAB-BHCG", -301, { resultText: "Beta-hCG 612 IU/L", abnormal: false });
  note(c8.episode, "doctor", -301, "10:00", "Beta-hCG 612. Viability scan in 2 weeks.");
  note(c8.episode, "doctor", -40, "12:00", "Delivered a live female infant. File closed with outcome live birth.");
  consents(c8, ["ivf", "cryo-storage", "embryo-disposition"], -462);
  addHistory(c8.female, { surgical: "Bilateral salpingectomy 2023 (hydrosalpinges)." });

  // 9 — Joy & Ekong Akpan: new, counselled today-1, baseline scan today+3
  const c9 = H({
    f: { first: "Joy", last: "Akpan", age: 39, title: "Dr" },
    m: { first: "Ekong", last: "Akpan", age: 43 },
    type: "IVF",
    diagnosis: ["Endometriosis"],
    doctorId: "S01",
    payer: "referral",
    branchId: "BR-01",
    openedOffset: -1,
  });
  makeCycle(c9.episode, {
    number: 1,
    kind: "fresh",
    protocol: "antagonist",
    stage: "baseline",
    startDate: day(3),
    outcome: "pending",
    amh: 0.9,
  });
  addOrder(c9, "SVC-CONS", -1);
  addOrder(c9, "SVC-COUN", -1);
  addOrder(c9, "LAB-AMH", -1, { status: "resulted", resultText: "AMH 0.9 ng/mL", abnormal: true });
  addOrder(c9, "LAB-FSH", 0, { status: "ordered" });
  addOrder(c9, "LAB-VIRAL", 0, { status: "in-progress" });
  addOrder(c9, "LAB-SA", 0, { status: "ordered" });
  note(
    c9.episode,
    "doctor",
    -1,
    "11:00",
    "39-year-old with stage III endometriosis (laparoscopy 2023), AMH 0.9. Plan antagonist IVF. Baseline tests ordered; baseline scan D2 of next cycle.",
  );
  note(
    c9.episode,
    "counselling",
    -1,
    "12:10",
    "First counselling session. Success rates for age 39 and AMH 0.9 discussed. Couple wishes to proceed.",
    "S09",
  );
  addHistory(c9.female, {
    gynae: "Severe dysmenorrhoea; endometriosis stage III.",
    surgical: "Laparoscopic excision of endometrioma 2023.",
  });

  // 10 — Mercy & Victor Ibe: cancelled cycle (poor response)
  const c10 = H({
    f: { first: "Mercy", last: "Ibe", age: 33 },
    m: { first: "Victor", last: "Ibe", age: 35 },
    type: "IVF",
    diagnosis: ["Poor responder"],
    doctorId: "S02",
    payer: "self-pay",
    branchId: "BR-01",
    openedOffset: -50,
    status: "on-hold",
  });
  const c10c = makeCycle(c10.episode, {
    number: 1,
    kind: "fresh",
    protocol: "antagonist",
    stage: "cancelled",
    startDate: day(-22),
    outcome: "cancelled",
    amh: 0.7,
    afc: 4,
    cancelReason: "Poor response: only 2 follicles at D9.",
    plan: "Mild protocol (letrozole + menotrophin 150 IU) next cycle; add CoQ10 and DHEA for 3 months.",
  });
  stimSeries(c10c, {
    startOffset: -21,
    scanDays: [1, 6, 9],
    finalDay: 9,
    right: [12],
    left: [11],
    endoFinal: 7.1,
    e2Final: 280,
    drugs: [{ drug: "Menotrophin 150 IU inj", dose: "300 IU" }],
    lastRemark: "Only 2 follicles (12, 11 mm). Cycle cancelled. Plan mild protocol next.",
    postedBy: "S02",
  });
  addOrder(c10, "SVC-CONS", -50);
  addOrder(c10, "SVC-IVF", -22);
  addOrder(c10, "DRG-MENO150", -21);
  addOrder(c10, "DRG-COQ", -12);
  note(
    c10.episode,
    "doctor",
    -13,
    "10:00",
    "D9: only 2 follicles. Cycle cancelled after discussion. Plan mild protocol next cycle.",
  );
  note(
    c10.episode,
    "counselling",
    -12,
    "11:00",
    "Emotional support offered after cancellation; couple coping well.",
    "S09",
  );
  consents(c10, ["ivf", "anaesthesia"], -23);
  addHistory(c10.female);

  // 11 — Latifat & Sani Yusuf: ICSI + PGT-A, 5 blastocysts biopsied today-3
  const c11 = H({
    f: { first: "Latifat", last: "Yusuf", age: 37 },
    m: { first: "Sani", last: "Yusuf", age: 42, title: "Engr" },
    type: "ICSI",
    diagnosis: ["Recurrent miscarriage"],
    doctorId: "S01",
    payer: "corporate",
    branchId: "BR-01",
    openedOffset: -45,
  });
  const c11c = makeCycle(c11.episode, {
    number: 1,
    kind: "fresh",
    protocol: "antagonist",
    stage: "culture",
    startDate: day(-21),
    outcome: "pending",
    amh: 2.8,
    afc: 16,
    trigger: { date: day(-11), drug: "Triptorelin 0.1 mg", time: "22:00" },
    ocr: { eggs: 14, mii: 11, fertilised: 9 },
    plan: "Freeze-all. Await PGT-A results; plan single euploid FET.",
  });
  stimSeries(c11c, {
    startOffset: -20,
    scanDays: [1, 6, 8, 10],
    finalDay: 10,
    right: [20, 18, 17, 16, 14],
    left: [19, 18, 16, 13],
    endoFinal: 10.2,
    e2Final: 3100,
    drugs: [
      { drug: "Follitropin alfa 300 IU pen", dose: "225 IU" },
      { drug: "Cetrorelix 0.25 mg", dose: "0.25 mg" },
    ],
    lastRemark: "Agonist trigger tonight (OHSS risk low but freeze-all planned).",
    postedBy: "S01",
  });
  procedure(c11c, "OCR", -9, "08:30", {
    count: 14,
    embryologistId: "S04",
    postOpNote: "14 COCs retrieved, 11 MII; ICSI.",
  });
  vitalsAround(c11.episode, -9, "08:30");
  addEmbryos(c11c, [
    { day: 5, grade: "4AA", status: "cryopreserved" },
    { day: 5, grade: "4AB", status: "cryopreserved" },
    { day: 6, grade: "4BB", status: "cryopreserved" },
    { day: 6, grade: "3BB", status: "cryopreserved" },
    { day: 6, grade: "4BC", status: "cryopreserved" },
    { day: 3, grade: "7-cell G2", status: "arrested" },
    { day: 3, grade: "6-cell G3", status: "arrested" },
    { day: 2, status: "arrested" },
    { day: 4, status: "arrested" },
  ]);
  cultureLog(c11c, -9, 6, "S04");
  procedure(c11c, "PGT", -3, "10:00", {
    count: 5,
    embryologistId: "S04",
    embryoGrade: "4AA, 4AB, 4BB, 3BB, 4BC",
    postOpNote: "Trophectoderm biopsy of 5 blastocysts (D5–D6). Samples sent for PGT-A; all blastocysts vitrified.",
    surgeonId: "S01",
  });
  addOrder(c11, "SVC-CONS", -45);
  addOrder(c11, "LAB-KARYO", -44, { resultText: "46,XX and 46,XY — normal karyotypes", abnormal: false });
  addOrder(c11, "SVC-IVF", -21);
  addOrder(c11, "SVC-ICSI", -21);
  addOrder(c11, "SVC-PGT", -3);
  addOrder(c11, "SVC-CRYO", -3);
  note(
    c11.episode,
    "doctor",
    -45,
    "10:00",
    "Three first-trimester miscarriages. Karyotypes normal. Plan ICSI with PGT-A.",
  );
  note(c11.episode, "doctor", -9, "12:30", "OCR 14 eggs, 11 MII. ICSI. Freeze-all after biopsy.");
  note(
    c11.episode,
    "doctor",
    -3,
    "13:00",
    "5 blastocysts biopsied for PGT-A; all vitrified. Results expected in 10–14 days.",
  );
  consents(c11, ["ivf", "icsi", "pgt", "cryo-storage", "embryo-disposition", "anaesthesia"], -22);
  addHistory(c11.female, { para: 0, miscarriages: 3 });

  // 12 — Tonye & Preye Cookey: on today's waiting list, first visit (no episode yet)
  const tonye = makePerson({
    first: "Tonye",
    last: "Cookey",
    sex: "F",
    age: 31,
    roles: ["patient"],
    branchId: "BR-01",
    payer: { category: "self-pay" },
    createdOffset: 0,
  });
  const preye = makePerson({
    first: "Preye",
    last: "Cookey",
    sex: "M",
    age: 34,
    roles: ["partner"],
    branchId: "BR-01",
    payer: { category: "self-pay" },
    createdOffset: 0,
    nokName: "Tonye Cookey",
  });
  tonye.nextOfKin = { name: "Preye Cookey", phone: preye.phone, relationship: "Husband" };

  // ================================================================ GENERATED COUPLES (28)
  const genTypes: EpisodeType[] = [
    "IVF",
    "IVF",
    "IVF",
    "IVF",
    "IVF",
    "IVF",
    "IVF",
    "ICSI",
    "ICSI",
    "ICSI",
    "ICSI",
    "ICSI",
    "ICSI",
    "IUI",
    "IUI",
    "IUI",
    "IUI",
    "FET",
    "FET",
    "FET",
    "FET",
    "DONOR-OOCYTE",
    "DONOR-SPERM",
    "DONOR-SPERM",
    "IVF",
    "ICSI",
    "FET",
    "IVF",
  ];
  const usedNames = new Set(data.persons.map((p) => `${p.firstName} ${p.lastName}`));
  const generated: Couple[] = [];
  genTypes.forEach((type, i) => {
    let last = rng.pick(SURNAMES);
    let ff = rng.pick(FEMALE_FIRST);
    while (usedNames.has(`${ff} ${last}`)) {
      last = rng.pick(SURNAMES);
      ff = rng.pick(FEMALE_FIRST);
    }
    usedNames.add(`${ff} ${last}`);
    const fAge = rng.int(28, 45);
    const branchId = "BR-01";
    const diag = rng.shuffle(DIAGNOSES).slice(0, rng.chance(0.3) ? 2 : 1);
    const closed = i % 5 === 4;
    const couple = makeCouple({
      f: { first: ff, last, age: fAge },
      m: { first: rng.pick(MALE_FIRST), last, age: Math.min(52, Math.max(30, fAge + rng.int(2, 9))) },
      type,
      diagnosis:
        type === "DONOR-SPERM"
          ? ["Male factor"]
          : fAge >= 40 && !diag.includes("Advanced maternal age")
            ? [...diag, "Advanced maternal age"]
            : [...diag],
      doctorId: i % 3 === 0 ? "S02" : "S01",
      payer: rng.pick(["self-pay", "self-pay", "self-pay", "hmo", "corporate", "referral"] as const),
      branchId,
      openedOffset: -rng.int(closed ? 200 : 40, closed ? 400 : 330),
      status: closed ? "closed" : i % 11 === 6 ? "on-hold" : "open",
    });
    generated.push(couple);
  });

  const currentStages: CycleStage[] = [
    "baseline",
    "stimulation",
    "stimulation",
    "trigger",
    "ocr",
    "transfer",
    "luteal",
    "pregnancy-test",
    "stimulation",
    "luteal",
  ];
  generated.forEach((couple, i) => {
    const ep = couple.episode;
    const opened = daysBetween(today, ep.openedAt); // negative number of days ago
    const protocol: CycleProtocol = rng.pick(["antagonist", "antagonist", "antagonist", "long-agonist"] as const);
    let cycleNo = 1;
    const fresh =
      ep.type === "IVF" ||
      ep.type === "ICSI" ||
      ep.type === "DONOR-SPERM" ||
      ep.type === "SURROGACY" ||
      ep.type === "FET" ||
      ep.type === "DONOR-OOCYTE";
    // past cycles
    if (ep.type === "IUI") {
      const pastCount = rng.int(1, 2);
      for (let k = 0; k < pastCount; k += 1) {
        const off = opened + 15 + k * 45;
        if (off > -30) break;
        const cyc = makeCycle(ep, {
          number: cycleNo,
          kind: "fresh",
          protocol: "mild",
          stage: "completed",
          startDate: day(off),
          outcome: "negative",
        });
        cyc.outcome = rng.chance(0.18) ? (off < -270 ? "live-birth" : "clinical-pregnancy") : "negative";
        cyc.transferPlan = { date: day(off + 14), embryoIds: [] };
        procedure(cyc, "ANDROLOGY", off + 14, "09:00", {
          count: rng.int(8, 40),
          embryologistId: rng.pick(EMBRYOLOGISTS),
          surgeonId: "S03",
          postOpNote: "Sperm prepared; IUI performed.",
        });
        cycleNo += 1;
      }
    } else if (fresh) {
      const firstOcr = opened + rng.int(18, 30);
      if (firstOcr < -20) {
        const kindDonor = ep.type === "DONOR-OOCYTE";
        const cyc = makeCycle(ep, {
          number: cycleNo,
          kind: "fresh",
          protocol: kindDonor ? "fet-hrt" : protocol,
          stage: "completed",
          startDate: day(firstOcr - 12),
          outcome: "pending",
          amh: rng.float(0.5, 4.5),
          afc: rng.int(4, 22),
        });
        simulateFresh(couple, cyc, firstOcr);
        if (kindDonor) data.embryos.filter((e) => e.cycleId === cyc.id).forEach((e) => (e.source = "donor-oocyte"));
        cycleNo += 1;
        // possible FET after
        const fetOff = firstOcr + rng.int(60, 120);
        if (fetOff < -25 && (ep.type === "FET" || rng.chance(0.45))) {
          const fet = makeCycle(ep, {
            number: cycleNo,
            kind: "frozen",
            protocol: "fet-hrt",
            stage: "completed",
            startDate: day(fetOff - 16),
            outcome: "pending",
          });
          if (simulateFet(couple, fet, fetOff)) cycleNo += 1;
          else data.cycles.splice(data.cycles.indexOf(fet), 1);
        }
      }
    }
    // current cycle for open episodes
    if (ep.status === "closed") {
      const last = data.cycles.filter((c) => c.episodeId === ep.id).pop();
      const outcome = last?.outcome ?? "negative";
      ep.closeReason =
        outcome === "live-birth"
          ? "live-birth"
          : outcome === "ongoing" || outcome === "clinical-pregnancy"
            ? "pregnancy-ongoing"
            : outcome === "miscarriage"
              ? "miscarriage"
              : rng.pick(["not-pregnant", "withdrawn", "transferred-out"] as const);
      ep.closedAt = day(Math.min(-5, (last ? daysBetween(today, last.startDate) : opened) + 40));
      ep.closeNote =
        ep.closeReason === "live-birth"
          ? "Live birth confirmed; file closed."
          : ep.closeReason === "pregnancy-ongoing"
            ? "Ongoing pregnancy; discharged to antenatal care."
            : "Couple decided to stop treatment for now.";
      if (last && last.stage !== "completed" && last.stage !== "cancelled") last.stage = "completed";
      if (last && last.outcome === "pending") last.outcome = "negative";
      return;
    }
    const stage = ep.status === "on-hold" ? "baseline" : (currentStages[i % currentStages.length] ?? "baseline");
    const female = couple.female;
    if (ep.type === "IUI") {
      const start = -rng.int(6, 10);
      const cyc = makeCycle(ep, {
        number: cycleNo,
        kind: "fresh",
        protocol: "mild",
        stage: stage === "baseline" ? "baseline" : "stimulation",
        startDate: day(start),
        outcome: "pending",
        afc: rng.int(8, 24),
      });
      if (cyc.stage === "stimulation") {
        stimSeries(cyc, {
          startOffset: start + 1,
          scanDays: [1, -start - 1],
          finalDay: -start - 1,
          right: [rng.int(14, 18)],
          left: [rng.int(10, 13)],
          endoFinal: rng.float(7.5, 9.5),
          e2Final: rng.int(220, 380),
          drugs: [{ drug: "Letrozole 2.5 mg", dose: "5 mg" }],
          postedBy: ep.doctorId,
          nextScanOffset: 2,
        });
      }
      addOrder(couple, "SVC-IUI", start);
      addOrder(couple, "DRG-LET", start + 1);
      return;
    }
    if (ep.type === "FET" || stage === "baseline") {
      if (ep.type === "FET") {
        const start = -rng.int(8, 14);
        const cyc = makeCycle(ep, {
          number: cycleNo,
          kind: "frozen",
          protocol: "fet-hrt",
          stage: "stimulation",
          startDate: day(start),
          outcome: "pending",
        });
        [1, -start].forEach((sd, k) => {
          data.stimulation.push({
            id: sid("ST"),
            cycleId: cyc.id,
            date: day(start + sd - 1),
            scanDay: sd === 1 ? "D1 baseline (HRT prep)" : `D${sd} endometrial scan`,
            injections: [{ drug: "Estradiol valerate 2 mg tabs", dose: "2 mg tds" }],
            endometriumMm: k === 0 ? 4.2 : rng.float(7.2, 9.8),
            follicles: { right: [], left: [] },
            e2: k === 0 ? 40 : rng.int(250, 450),
            remark: k === 0 ? "Start E2 valerate." : "Lining adequate; plan progesterone start.",
            postedBy: ep.doctorId,
          });
        });
        addOrder(couple, "SVC-FET", start);
        addOrder(couple, "DRG-EV2", start);
      } else {
        makeCycle(ep, {
          number: cycleNo,
          kind: "fresh",
          protocol,
          stage: "baseline",
          startDate: day(rng.int(1, 12)),
          outcome: "pending",
          amh: rng.float(0.6, 4.8),
        });
      }
      return;
    }
    const age = ageYears(female.dob);
    if (stage === "stimulation" || stage === "trigger") {
      const stimDay = stage === "trigger" ? 11 : rng.int(5, 9);
      const start = -(stimDay - 1);
      const cyc = makeCycle(ep, {
        number: cycleNo,
        kind: "fresh",
        protocol,
        stage,
        startDate: day(start - 1),
        outcome: "pending",
        amh: rng.float(0.8, 4.5),
        afc: rng.int(6, 20),
        trigger:
          stage === "trigger" ? { date: day(0), drug: "Choriogonadotropin alfa 250 mcg", time: "22:00" } : undefined,
      });
      const count = age >= 40 ? 3 : rng.int(4, 6);
      const right = Array.from({ length: count }, () =>
        rng.int(stage === "trigger" ? 15 : 9, stage === "trigger" ? 20 : 15),
      );
      const left = Array.from({ length: count - 1 }, () =>
        rng.int(stage === "trigger" ? 14 : 8, stage === "trigger" ? 19 : 14),
      );
      const days = stimDay >= 8 ? [1, 5, stimDay] : [1, stimDay];
      stimSeries(cyc, {
        startOffset: start,
        scanDays: days,
        finalDay: stimDay,
        right,
        left,
        endoFinal: rng.float(7.5, 10.5),
        e2Final: rng.int(800, 2600),
        drugs: [
          { drug: rng.pick(["Follitropin alfa 300 IU pen", "Menotrophin 150 IU inj"] as const), dose: "225 IU" },
          ...(stimDay >= 6 ? [{ drug: "Cetrorelix 0.25 mg", dose: "0.25 mg" }] : []),
        ],
        lastRemark:
          stage === "trigger" ? "≥3 follicles ≥17 mm. Trigger tonight 22:00." : `For D${stimDay + 2} follicular scan.`,
        nextScanOffset: stage === "trigger" ? undefined : 2,
        postedBy: ep.doctorId,
      });
      addOrder(couple, ep.type === "ICSI" ? "SVC-ICSI" : "SVC-IVF", start - 1);
      addOrder(couple, "DRG-FOL300", start);
      if (stimDay >= 6) addOrder(couple, "DRG-CET", -1);
      return;
    }
    if (stage === "ocr") {
      const ocrOff = -rng.int(1, 3);
      const cyc = makeCycle(ep, {
        number: cycleNo,
        kind: "fresh",
        protocol,
        stage: "culture",
        startDate: day(ocrOff - 13),
        outcome: "pending",
        amh: rng.float(1, 4),
      });
      const eggs = rng.int(6, 13);
      cyc.ocr = { eggs, mii: eggs - 2, fertilised: eggs - 4 };
      procedure(cyc, "OCR", ocrOff, "08:30", {
        count: eggs,
        embryologistId: "S05",
        postOpNote: `${eggs} COCs retrieved. Stable post-op.`,
      });
      vitalsAround(ep, ocrOff, "08:30");
      const dd = -ocrOff;
      addEmbryos(
        cyc,
        Array.from({ length: eggs - 4 }, (_, k) => ({
          day: dd,
          grade: dd >= 2 && k < 3 ? rng.pick(CLEAVAGE_GRADES) : undefined,
          status: "culturing" as const,
        })),
      );
      cultureLog(cyc, ocrOff, dd, "S05");
      addOrder(couple, ep.type === "ICSI" ? "SVC-ICSI" : "SVC-IVF", ocrOff - 13);
      addOrder(couple, "SVC-OCR", ocrOff);
      return;
    }
    // transfer / luteal / pregnancy-test: fresh cycle done recently
    const ocrOff = stage === "transfer" ? -5 : stage === "luteal" ? -rng.int(9, 13) : -16;
    const cyc = makeCycle(ep, {
      number: cycleNo,
      kind: "fresh",
      protocol,
      stage: "culture",
      startDate: day(ocrOff - 13),
      outcome: "pending",
      amh: rng.float(1, 4),
    });
    simulateFresh(couple, cyc, ocrOff);
    if (cyc.stage !== "cancelled") {
      cyc.stage = stage === "transfer" ? "transfer" : stage;
      cyc.outcome = "pending";
      if (stage === "transfer" && cyc.transferPlan) {
        // ET is today: keep the procedure as a draft for the demo
        const et = data.procedures.find((p) => p.cycleId === cyc.id && p.type === "ET");
        if (et) {
          et.status = "draft";
          et.signatureDataUrl = undefined;
          et.signedAt = undefined;
        }
        cyc.transferPlan.embryoIds.forEach((eid) => {
          const e = data.embryos.find((x) => x.id === eid);
          if (e) e.status = "culturing";
        });
      }
      cyc.betaHcg = stage === "pregnancy-test" ? { date: day(0) } : { date: day(ocrOff + 16) };
    }
    addOrder(couple, ep.type === "ICSI" ? "SVC-ICSI" : "SVC-IVF", ocrOff - 13);
    addOrder(couple, "SVC-OCR", ocrOff);
    addOrder(couple, "DRG-PIO", ocrOff);
  });

  // generic orders, notes, consents and histories for generated couples
  generated.forEach((couple, i) => {
    const ep = couple.episode;
    const opened = daysBetween(today, ep.openedAt);
    addOrder(couple, "SVC-CONS", opened);
    addOrder(couple, rng.pick(["LAB-AMH", "LAB-FSH", "LAB-TSH", "LAB-PRL", "LAB-VITD"] as const), opened + 1);
    if (rng.chance(0.6)) addOrder(couple, "LAB-VIRAL", opened + 1);
    if (rng.chance(0.5)) addOrder(couple, "RAD-BTVS", opened + 2);
    if (rng.chance(0.4))
      addOrder(couple, rng.pick(["DRG-FA", "DRG-VD3", "DRG-MET", "DRG-COQ", "DRG-ASP"] as const), opened + 2);
    if (ep.type === "DONOR-OOCYTE") addOrder(couple, "SVC-DONOR", opened + 5);
    if (i === 0)
      addOrder(couple, "LAB-TSH", -1, {
        status: "resulted",
        resultText: "TSH 9.8 mIU/L — markedly raised",
        abnormal: true,
        critical: true,
      });
    if (i === 2) addOrder(couple, "LAB-PRL", 0, { status: "ordered" });
    if (i === 5) addOrder(couple, "RAD-HSG", 0, { status: "in-progress" });
    const active = ep.status !== "closed";
    const n = active ? rng.int(3, 6) : rng.int(1, 3);
    const phrases = [
      "Seen with partner. History reviewed; plan explained and consents discussed.",
      "Baseline bloods reviewed: within normal limits. Proceed with treatment plan.",
      "Scan reviewed with patient. Questions answered; anxious but coping.",
      "Medication schedule reviewed; injection technique confirmed.",
      "Telephone follow-up: no side effects reported. Next visit confirmed.",
      "Partner SFA reviewed; suitable for planned insemination method.",
    ];
    for (let k = 0; k < n; k += 1) {
      const off = Math.min(0, opened + Math.round((-opened / (n + 1)) * (k + 1)));
      note(
        ep,
        k % 3 === 2 ? "nurse" : "doctor",
        off,
        `${pad(rng.int(9, 15), 2)}:${pad(rng.pick([0, 20, 40]), 2)}`,
        rng.pick(phrases),
      );
    }
    const tpls: ConsentTemplate[] =
      ep.type === "IUI"
        ? ["ivf"]
        : ep.type === "ICSI"
          ? ["ivf", "icsi", "anaesthesia", "cryo-storage"]
          : ep.type === "DONOR-OOCYTE" || ep.type === "DONOR-SPERM"
            ? ["ivf", "donor", "cryo-storage"]
            : ["ivf", "anaesthesia", "cryo-storage", "embryo-disposition"];
    consents(couple, tpls, opened + 3);
    if (i % 2 === 0) addHistory(couple.female);
  });

  // ================================================================ cancelled drugs (6)
  const cancelReasons = [
    "Duplicate prescription",
    "Dose changed by doctor",
    "Patient declined — purchased elsewhere",
    "Cycle cancelled (poor response)",
    "Drug out of stock — substituted",
    "Allergy concern; switched to alternative",
  ];
  const cancelTargets: Couple[] = [c10, c1, c4, generated[1], generated[6], generated[9]].filter((c): c is Couple =>
    Boolean(c),
  );
  cancelTargets.forEach((c, k) => {
    addOrder(
      c,
      rng.pick(["DRG-GAN", "DRG-MENO150", "DRG-PGEL", "DRG-CLO", "DRG-ENOX", "DRG-DOXY"] as const),
      -rng.int(2, 25),
      { status: "cancelled", cancelReason: cancelReasons[k] },
    );
  });

  // ================================================================ drug batches & stock movements
  DRUG_SEED.forEach((drug, i) => {
    const nBatches = i % 3 === 0 ? 3 : 2;
    let remaining = drug.stock;
    for (let b = 0; b < nBatches; b += 1) {
      const qty = b === nBatches - 1 ? remaining : Math.round(drug.stock * (b === 0 ? 0.35 : 0.3));
      remaining -= qty;
      let expiryOffset = rng.int(180, 640);
      if (b === 0 && ["DRG-CET", "DRG-PIO", "DRG-ASP"].includes(drug.code)) expiryOffset = rng.int(18, 55);
      if (b === 0 && drug.code === "DRG-DOXY") expiryOffset = -6;
      data.batches.push({
        id: sid("BAT", 4),
        code: drug.code,
        batchNo: `${drug.code.slice(4, 8)}${pad(rng.int(1000, 9999), 4)}-${String.fromCharCode(65 + b)}`,
        qty,
        expiry: day(expiryOffset),
        receivedAt: day(-rng.int(60, 200)),
      });
    }
  });
  data.orders
    .filter((o) => o.kind === "pharmacy" && o.status === "dispensed")
    .forEach((o) => {
      const batch = data.batches
        .filter((b) => b.code === o.catalogCode && b.qty >= o.qty && b.expiry > today)
        .sort((a, b) => a.expiry.localeCompare(b.expiry))[0];
      if (!batch) return;
      batch.qty -= o.qty;
      data.movements.push({
        id: sid("MOV"),
        code: o.catalogCode,
        batchId: batch.id,
        delta: -o.qty,
        reason: `Dispensed for order ${o.id}`,
        kind: "dispense",
        orderId: o.id,
        at: o.dispensedAt ?? o.at,
        by: "S10",
      });
    });
  // force a few low-stock items (below reorder level) for the alert panel
  (["DRG-OVI", "DRG-CAB", "DRG-LEU"] as const).forEach((code) => {
    const drug = DRUG_SEED.find((d) => d.code === code);
    const batches = data.batches.filter((b) => b.code === code);
    if (!drug) return;
    batches.forEach((b, k) => {
      const target = k === 0 ? Math.max(1, Math.floor(drug.reorderLevel / 2) - 1) : 0;
      if (b.qty > target) {
        data.movements.push({
          id: sid("MOV"),
          code,
          batchId: b.id,
          delta: target - b.qty,
          reason: "Stock count variance (quarterly audit)",
          kind: "adjust",
          at: at(-20, "16:00"),
          by: "S10",
        });
        b.qty = target;
      }
    });
  });

  // ================================================================ cryo-storage positions
  const occupied = new Set<string>();
  const allocate = (
    kind: StorageItemKind,
    label: string,
    storedAt: string,
    ownerPersonId?: string,
    itemId?: string,
  ): StoragePosition => {
    for (;;) {
      const tank = rng.pick(TANKS);
      const canister = rng.int(1, 6);
      const goblet = rng.pick(GOBLETS);
      const straw = rng.int(1, 10);
      const key = `${tank}-${canister}-${goblet}-${straw}`;
      if (occupied.has(key)) continue;
      occupied.add(key);
      let expiry = shiftDate(storedAt, 365);
      while (expiry < day(60)) expiry = shiftDate(expiry, 365);
      const pos: StoragePosition = {
        id: sid("POS", 4),
        tank,
        canister,
        goblet,
        straw,
        itemKind: kind,
        itemId,
        label,
        ownerPersonId,
        storedAt,
        consentExpiry: expiry,
      };
      data.storage.push(pos);
      return pos;
    }
  };
  const cycleById = new Map(data.cycles.map((c) => [c.id, c]));
  const episodeById = new Map(data.episodes.map((e) => [e.id, e]));
  const freshPriority = new Set([c2c.id, c11c.id, c4a.id, c5c.id, c7a.id]);
  const cryo = data.embryos
    .filter((e) => e.status === "cryopreserved")
    .sort((a, b) => Number(freshPriority.has(b.cycleId)) - Number(freshPriority.has(a.cycleId)));
  cryo.forEach((e, k) => {
    if (k >= 29) {
      e.status = "discarded";
      return;
    }
    const cyc = cycleById.get(e.cycleId);
    const ep = cyc ? episodeById.get(cyc.episodeId) : undefined;
    const proc = data.procedures.find((p) => p.cycleId === e.cycleId && (p.type === "OCR" || p.type === "PGT"));
    const storedAt =
      e.cycleId === c2c.id ? today : e.cycleId === c11c.id ? day(-3) : proc ? shiftDate(proc.date, e.day) : day(-100);
    const pos = allocate(
      "embryo",
      `${ep?.ivfNo ?? ""} ${e.label} ${e.grade ?? ""}`.trim(),
      storedAt,
      ep?.patientId,
      e.id,
    );
    e.storagePositionId = pos.id;
    const witness = proc?.embryologistId === "S04" ? "S05" : "S04";
    data.custody.push({
      id: sid("CUS"),
      itemId: e.id,
      action: "stored",
      detail: `Vitrified and stored at ${pos.tank}-C${pos.canister}-${pos.goblet}-S${pos.straw}`,
      at: lagosDateTime(storedAt, "14:00"),
      by: proc?.embryologistId ?? "S04",
      witnessId: witness,
    });
  });
  // oocytes (fertility preservation) and sperm (donor + patient) samples
  const fp = generated[3];
  for (let k = 0; k < 5; k += 1)
    allocate(
      "oocyte",
      `${fp?.episode.ivfNo ?? "FP"} vitrified MII oocytes ×${rng.int(3, 6)}`,
      day(-rng.int(30, 300)),
      fp?.female.id,
    );
  // consent expiry demo cases: 1 expired + 3 within 45 days
  const byStored = [...data.storage].sort((a, b) => a.storedAt.localeCompare(b.storedAt));
  const exp = byStored.filter((p) => !freshPriority.has(data.embryos.find((e) => e.id === p.itemId)?.cycleId ?? ""));
  const e0 = exp[0];
  if (e0) e0.consentExpiry = day(-6);
  [12, 27, 41].forEach((offset, k) => {
    const p = exp[k + 1];
    if (p) p.consentExpiry = day(offset);
  });

  // ================================================================ donors & surrogates
  const donorOocyte: { status: "available" | "matched" | "in-cycle" | "screening" | "retired"; pending?: boolean }[] = [
    { status: "available" },
    { status: "available" },
    { status: "matched" },
    { status: "in-cycle" },
    { status: "available" },
    { status: "screening", pending: true },
    { status: "available" },
    { status: "retired" },
  ];
  donorOocyte.forEach((d, k) => {
    const age = rng.int(22, 31);
    const person = makePerson({
      first: rng.pick(FEMALE_FIRST),
      last: rng.pick(SURNAMES),
      sex: "F",
      age,
      roles: ["donor"],
      branchId: "BR-01",
      payer: { category: "self-pay" },
      createdOffset: -rng.int(60, 400),
      title: "Ms",
      nokRelationship: "Sister",
    });
    const code = `DON-F-${pad(k + 1, 3)}`;
    const matchedEp =
      d.status === "matched"
        ? c3.episode.id
        : d.status === "in-cycle"
          ? generated.find((g) => g.episode.type === "DONOR-OOCYTE")?.episode.id
          : undefined;
    data.donors.push({
      id: sid("DN", 3),
      personId: person.id,
      kind: "oocyte",
      code,
      age,
      bloodGroup: k === 2 ? "O+" : (person.bloodGroup ?? "O+"),
      height: k === 2 ? 1.68 : rng.float(1.55, 1.78, 2),
      eyeColour: rng.pick(EYE_COLOURS),
      hairColour: rng.pick(HAIR_COLOURS),
      complexion: k === 2 ? "Medium brown" : rng.pick(COMPLEXIONS),
      screening: {
        hiv: "negative",
        hepB: "negative",
        hepC: "negative",
        syphilis: d.pending ? "pending" : "negative",
        karyotype: d.pending ? "pending" : "normal",
        geneticPanel: d.pending ? "pending" : "clear",
      },
      status: d.status,
      matchedEpisodeId: matchedEp,
      amh: rng.float(2.8, 6.2),
      history: [
        { at: day(-rng.int(200, 400)), label: "Registered; screening started" },
        ...(d.pending ? [] : [{ at: day(-rng.int(100, 199)), label: "Screening complete — eligible" }]),
        ...(d.status === "matched" ? [{ at: day(-30), label: `Matched to ${c3.episode.ivfNo}` }] : []),
        ...(d.status === "in-cycle" ? [{ at: day(-12), label: "Stimulation started for recipient cycle" }] : []),
        ...(d.status === "retired" ? [{ at: day(-50), label: "Retired after 6 donation cycles" }] : []),
      ],
    });
  });
  (["available", "available", "available", "retired"] as const).forEach((status, k) => {
    const age = rng.int(22, 35);
    const person = makePerson({
      first: rng.pick(MALE_FIRST),
      last: rng.pick(SURNAMES),
      sex: "M",
      age,
      roles: ["donor"],
      branchId: "BR-01",
      payer: { category: "self-pay" },
      createdOffset: -rng.int(100, 500),
      title: "Mr",
      nokRelationship: "Brother",
    });
    data.donors.push({
      id: sid("DN", 3),
      personId: person.id,
      kind: "sperm",
      code: `DON-M-${pad(k + 1, 3)}`,
      age,
      bloodGroup: person.bloodGroup ?? "O+",
      height: rng.float(1.68, 1.9, 2),
      eyeColour: rng.pick(EYE_COLOURS),
      hairColour: rng.pick(HAIR_COLOURS),
      complexion: rng.pick(COMPLEXIONS),
      screening: {
        hiv: "negative",
        hepB: "negative",
        hepC: "negative",
        syphilis: "negative",
        karyotype: "normal",
        geneticPanel: "clear",
      },
      status,
      history: [
        { at: day(-rng.int(150, 400)), label: "Registered; screening complete — eligible" },
        ...(status === "retired" ? [{ at: day(-90), label: "Retired (family limit reached)" }] : []),
      ],
    });
    if (k < 3) allocate("sperm", `DON-M-${pad(k + 1, 3)} straws ×${rng.int(4, 10)}`, day(-rng.int(40, 250)), person.id);
  });
  allocate("sperm", `${c2.episode.ivfNo} partner backup sample`, day(-6), c2.male.id);

  const surrogateDefs: { status: "screening" | "approved" | "matched" | "pregnant" | "delivered" }[] = [
    { status: "approved" },
    { status: "matched" },
    { status: "screening" },
    { status: "approved" },
    { status: "pregnant" },
    { status: "delivered" },
  ];
  surrogateDefs.forEach((s, k) => {
    const age = rng.int(24, 36);
    const person = makePerson({
      first: rng.pick(FEMALE_FIRST),
      last: rng.pick(SURNAMES),
      sex: "F",
      age,
      roles: ["surrogate"],
      branchId: "BR-01",
      payer: { category: "self-pay" },
      createdOffset: -rng.int(60, 500),
      title: "Mrs",
    });
    const screening = s.status === "screening";
    const intending =
      s.status === "pregnant" || s.status === "delivered"
        ? generated.find((g) => g.episode.status === "closed" && g.episode.closeReason === "live-birth")?.episode.id
        : undefined;
    data.surrogates.push({
      id: sid("SG", 3),
      personId: person.id,
      code: `SUR-${pad(k + 1, 3)}`,
      age,
      parity: rng.int(1, 3),
      screening: {
        medical: screening ? "pending" : "cleared",
        psychological: screening ? "pending" : "cleared",
        uterineEval: screening ? "pending" : "normal",
        legal: s.status === "approved" || screening ? "pending" : "signed",
      },
      status: s.status,
      matchedEpisodeId: s.status === "matched" ? c7.episode.id : intending,
      legalSignedAt:
        s.status === "matched"
          ? day(-35)
          : s.status === "pregnant" || s.status === "delivered"
            ? day(-rng.int(200, 400))
            : undefined,
      history: [
        { at: day(-rng.int(300, 500)), label: "Application received" },
        ...(screening
          ? []
          : [{ at: day(-rng.int(150, 299)), label: "Medical, psychological and uterine evaluation cleared" }]),
        ...(s.status === "matched"
          ? [
              { at: day(-40), label: `Matched to ${c7.episode.ivfNo}` },
              { at: day(-35), label: "Legal agreement signed" },
            ]
          : []),
        ...(s.status === "pregnant"
          ? [
              { at: day(-120), label: "Embryo transfer" },
              { at: day(-105), label: "Clinical pregnancy confirmed" },
            ]
          : []),
        ...(s.status === "delivered" ? [{ at: day(-60), label: "Delivered live infant" }] : []),
      ],
    });
  });

  // ================================================================ counselling (14)
  const counsel = (
    couple: Couple,
    offset: number,
    clientType: "new" | "returning" | "donor-recipient" | "surrogacy-intending",
    notes: string,
    checklist: string[],
  ): void => {
    data.counselling.push({
      id: sid("CNS", 4),
      personId: couple.female.id,
      partnerId: couple.male.id,
      date: day(offset),
      complexion: rng.pick(COMPLEXIONS),
      afc: data.cycles.find((c) => c.episodeId === couple.episode.id)?.afc,
      lmp: day(offset - rng.int(3, 20)),
      bloodGroup: couple.female.bloodGroup,
      wifePhone: couple.female.phone,
      husbandPhone: couple.male.phone,
      email: couple.female.email || undefined,
      referral: rng.pick(["Self", "Dr. A. Coker (St. Nicholas)", "Friend/relative", "Instagram", "HMO referral"]),
      children: rng.chance(0.2) ? 1 : 0,
      clientType,
      notes,
      checklist,
      counsellorId: "S09",
    });
  };
  counsel(
    c9,
    -1,
    "new",
    "First visit. Explained IVF pathway, stage III endometriosis implications, success rates at 39 with AMH 0.9. Couple keen to proceed.",
    ["Explained IVF pathway", "Discussed success rates by age", "Reviewed costs and packages"],
  );
  counsel(
    c3,
    -70,
    "donor-recipient",
    "Donor anonymity and phenotype matching explained; couple prefers donor with O+ blood group and medium complexion.",
    [
      "Donor anonymity explained",
      "Phenotype matching discussed",
      "Legal parentage explained",
      "Donor consent reviewed",
    ],
  );
  counsel(
    c7,
    -150,
    "surrogacy-intending",
    "MRKH; surrogacy pathway, legal agreement and coordination costs explained. Couple accepts.",
    ["Surrogacy pathway explained", "Legal agreement reviewed", "Costs and coordination fee"],
  );
  counsel(
    c10,
    -12,
    "returning",
    "Supportive counselling after cancelled cycle. Discussed mild protocol and realistic expectations.",
    ["Reviewed previous cycle", "Emotional wellbeing check", "Discussed next protocol"],
  );
  counsel(
    c1,
    -12,
    "returning",
    "Second IVF attempt after negative cycle 1. Anxiety addressed; coping strategies shared.",
    ["Reviewed previous cycle", "Emotional wellbeing check"],
  );
  counsel(c11, -44, "new", "Recurrent miscarriage — PGT-A explained including mosaic results and limitations.", [
    "Explained IVF pathway",
    "Reviewed costs and packages",
  ]);
  counsel(c2, -58, "new", "Severe male factor; ICSI explained. Husband reassured about andrology plan.", [
    "Explained IVF pathway",
    "Discussed success rates by age",
    "Baseline tests explained",
  ]);
  generated.slice(0, 7).forEach((g, k) => {
    const type =
      g.episode.type === "DONOR-OOCYTE" || g.episode.type === "DONOR-SPERM"
        ? "donor-recipient"
        : k % 2 === 0
          ? "new"
          : "returning";
    counsel(
      g,
      daysBetween(today, g.episode.openedAt),
      type,
      type === "donor-recipient"
        ? "Donor programme counselling; anonymity and matching explained."
        : type === "new"
          ? "Initial counselling: treatment pathway, timeline and costs explained."
          : "Follow-up counselling; couple coping well, questions answered.",
      type === "donor-recipient"
        ? ["Donor anonymity explained", "Legal parentage explained"]
        : ["Explained IVF pathway", "Reviewed costs and packages"],
    );
  });

  // ================================================================ payments (70 / 20 / 10 split per charge)
  const paymentDrafts: Omit<Payment, "receiptNo">[] = [];
  const methodFor = (payer: PayerCategory): PaymentMethod =>
    payer === "hmo"
      ? "hmo"
      : payer === "corporate"
        ? "transfer"
        : rng.pick(["cash", "pos", "transfer", "transfer", "deposit"] as const);
  data.charges
    .filter((c) => c.status !== "waived")
    .forEach((charge: Charge) => {
      const r = rng.next();
      if (r >= 0.9) return;
      const amount = r < 0.7 ? charge.amount : Math.round((charge.amount * rng.float(0.3, 0.7, 2)) / 500) * 500;
      if (amount <= 0) return;
      charge.paid = amount;
      charge.status = amount >= charge.amount ? "paid" : "part-paid";
      const chargeDay = charge.at.slice(0, 10);
      const payOffset = Math.min(0, daysBetween(today, chargeDay) + rng.int(0, 2));
      const method = methodFor(charge.payer);
      paymentDrafts.push({
        id: sid("PAY"),
        episodeId: charge.episodeId,
        amount,
        method,
        reference:
          method === "transfer"
            ? `TRF${rng.int(10000000, 99999999)}`
            : method === "pos"
              ? `POS-${rng.int(100000, 999999)}`
              : method === "hmo"
                ? `AUTH-${rng.int(10000, 99999)}`
                : undefined,
        receivedBy: "S13",
        at: at(payOffset, `${pad(rng.int(9, 16), 2)}:${pad(rng.int(0, 59), 2)}`),
      });
    });
  paymentDrafts
    .sort((a, b) => a.at.localeCompare(b.at))
    .forEach((p, k) => data.payments.push({ ...p, receiptNo: `RCP-${pad(k + 1, 6)}` }));

  // HMO claims
  data.episodes
    .filter((e) => data.persons.find((p) => p.id === e.patientId)?.payer.category === "hmo")
    .forEach((e, k) => {
      const amount = data.charges.filter((c) => c.episodeId === e.id).reduce((s, c) => s + c.amount, 0);
      const status = (["submitted", "approved", "rejected", "approved", "submitted"] as const)[k % 5] ?? "submitted";
      data.claims.push({
        id: sid("CLM", 4),
        episodeId: e.id,
        hmo: data.persons.find((p) => p.id === e.patientId)?.payer.sponsor ?? "HMO",
        amount,
        status,
        submittedAt: day(-rng.int(5, 60)),
        decidedAt: status === "submitted" ? undefined : day(-rng.int(1, 4)),
      });
    });

  // ================================================================ waiting list
  const waitPurposes = [
    "Follicular scan",
    "Consultation",
    "Review of results",
    "Injection teaching",
    "Pre-OCR review",
    "Pregnancy test review",
  ];
  const anchorMs = anchor.getTime();
  const minsAgo = (m: number): string => new Date(anchorMs - m * 60_000).toISOString();
  const pickCouple = (k: number): Couple => generated[(k * 3) % generated.length] ?? c5;
  const todayEntries: {
    person: Person;
    ep?: Episode;
    status: WaitingStatus;
    arrived: number;
    called?: number;
    seen?: number;
    done?: number;
    purpose: string;
    doctorId: string;
  }[] = [
    { person: tonye, status: "waiting", arrived: 12, purpose: "First consultation", doctorId: "S01" },
    { person: c6.female, ep: c6.episode, status: "waiting", arrived: 25, purpose: "Pre-IUI review", doctorId: "S02" },
    {
      person: pickCouple(1).female,
      ep: pickCouple(1).episode,
      status: "called",
      arrived: 38,
      called: 2,
      purpose: rng.pick(waitPurposes),
      doctorId: "S02",
    },
    {
      person: c1.female,
      ep: c1.episode,
      status: "in-consultation",
      arrived: 55,
      called: 20,
      seen: 18,
      purpose: "D8 follicular scan",
      doctorId: "S01",
    },
    {
      person: c4.female,
      ep: c4.episode,
      status: "in-consultation",
      arrived: 70,
      called: 35,
      seen: 33,
      purpose: "Pre-FET review",
      doctorId: "S02",
    },
    {
      person: c5.female,
      ep: c5.episode,
      status: "completed",
      arrived: 110,
      called: 80,
      seen: 78,
      done: 55,
      purpose: "Luteal support review",
      doctorId: "S01",
    },
  ];
  todayEntries.forEach((w) =>
    data.waiting.push({
      id: sid("WL", 5),
      personId: w.person.id,
      episodeId: w.ep?.id,
      date: today,
      time: formatTime(minsAgo(w.arrived)),
      arrivedAt: minsAgo(w.arrived),
      calledAt: w.called !== undefined ? minsAgo(w.called) : undefined,
      seenAt: w.seen !== undefined ? minsAgo(w.seen) : undefined,
      completedAt: w.done !== undefined ? minsAgo(w.done) : undefined,
      doctorId: w.doctorId,
      purpose: w.purpose,
      status: w.status,
      branchId: "BR-01",
    }),
  );
  // two no-shows yesterday + history for the wait-time trend
  [pickCouple(4), pickCouple(6)].forEach((c) =>
    data.waiting.push({
      id: sid("WL", 5),
      personId: c.female.id,
      episodeId: c.episode.id,
      date: day(-1),
      time: "10:00",
      arrivedAt: at(-1, "10:00"),
      doctorId: c.episode.doctorId,
      purpose: "Follicular scan",
      status: "no-show",
      branchId: c.episode.branchId,
    }),
  );
  for (let d = -14; d <= -1; d += 1) {
    const n = rng.int(4, 7);
    for (let k = 0; k < n; k += 1) {
      const c = generated[rng.int(0, generated.length - 1)] ?? c1;
      const arriveH = rng.int(8, 13);
      const arriveM = rng.int(0, 59);
      const wait = Math.max(6, Math.round(rng.int(12, 48) - (d + 14) * 1.1));
      const arrived = at(d, `${pad(arriveH, 2)}:${pad(arriveM, 2)}`);
      const called = new Date(new Date(arrived).getTime() + wait * 60_000).toISOString();
      data.waiting.push({
        id: sid("WL", 5),
        personId: c.female.id,
        episodeId: c.episode.id,
        date: day(d),
        time: `${pad(arriveH, 2)}:${pad(arriveM, 2)}`,
        arrivedAt: arrived,
        calledAt: called,
        seenAt: called,
        completedAt: new Date(new Date(called).getTime() + rng.int(10, 30) * 60_000).toISOString(),
        doctorId: c.episode.doctorId,
        purpose: rng.pick(waitPurposes),
        status: "completed",
        branchId: c.episode.branchId,
      });
    }
  }

  // ================================================================ documents
  const docFor = (
    c: Couple,
    name: string,
    category: "referral" | "lab-report" | "scan" | "consent" | "id" | "other",
    offset: number,
  ): void => {
    data.documents.push({
      id: sid("DOC", 4),
      episodeId: c.episode.id,
      name,
      category,
      sizeKb: rng.int(80, 2400),
      mime: name.endsWith(".pdf") ? "application/pdf" : "image/jpeg",
      uploadedAt: at(offset, "11:00"),
      uploadedBy: rng.pick(["S16", "S17", "S07"]),
    });
  };
  docFor(c1, "Laparoscopy report 2024.pdf", "referral", -189);
  docFor(c1, "HSG images.jpg", "scan", -185);
  docFor(c2, "Andrology referral letter.pdf", "referral", -60);
  docFor(c3, "Previous IVF summaries.pdf", "referral", -75);
  docFor(c7, "MRI pelvis 2010.pdf", "scan", -160);
  docFor(c7, "Surrogacy agreement (signed).pdf", "consent", -35);
  docFor(c9, "Referral letter - Dr Coker.pdf", "referral", -1);
  docFor(c11, "Karyotype reports.pdf", "lab-report", -40);

  // ================================================================ staff requests (12)
  const req = (r: Omit<StaffRequest, "id">): void => {
    data.requests.push({ id: sid("REQ", 4), ...r });
  };
  req({
    kind: "item",
    title: "Restock Cetrorelix and Ovitrelle",
    details: "Cetrorelix 40 vials and Ovitrelle 20 pens — stock below reorder level.",
    amount: 2_420_000,
    requesterId: "S10",
    status: "pending",
    createdAt: at(-1, "10:00"),
  });
  req({
    kind: "leave",
    title: "Annual leave",
    details: "Family event in Owerri.",
    startDate: day(14),
    endDate: day(18),
    requesterId: "S07",
    status: "pending",
    createdAt: at(-2, "12:00"),
  });
  req({
    kind: "manpower",
    title: "Additional embryologist (locum)",
    details: "Lab volume up 30% this quarter; need a locum embryologist 3 days/week.",
    requesterId: "S04",
    status: "pending",
    createdAt: at(-3, "09:30"),
  });
  req({
    kind: "job",
    title: "Repair air-conditioner in waiting room",
    details: "AC unit 2 leaking and noisy since Monday.",
    requesterId: "S16",
    status: "pending",
    createdAt: at(-1, "08:45"),
  });
  req({
    kind: "reimbursement",
    title: "ESHRE webinar registration",
    details: "Registration fee for the online ESHRE embryology update.",
    amount: 85_000,
    attachmentName: "eshre-receipt.pdf",
    requesterId: "S05",
    status: "pending",
    createdAt: at(-4, "15:10"),
  });
  req({
    kind: "confirmation",
    title: "Confirmation of appointment",
    details: "Completed 6-month probation at Redemption City; request confirmation.",
    requesterId: "S17",
    status: "pending",
    createdAt: at(-5, "11:20"),
  });
  req({
    kind: "leave",
    title: "Sick leave",
    details: "Malaria — doctor's note attached.",
    startDate: day(-12),
    endDate: day(-10),
    requesterId: "S08",
    status: "approved",
    approverId: "S15",
    comment: "Get well soon.",
    decidedAt: at(-12, "09:00"),
    createdAt: at(-12, "07:30"),
  });
  req({
    kind: "item",
    title: "Lab reagents — AMH kits",
    details: "2 AMH ELISA kits.",
    amount: 640_000,
    requesterId: "S11",
    status: "approved",
    approverId: "S15",
    comment: "Approved within budget.",
    decidedAt: at(-8, "14:00"),
    createdAt: at(-9, "10:00"),
  });
  req({
    kind: "reimbursement",
    title: "Fuel for emergency call-out",
    details: "Weekend OCR emergency call-out fuel.",
    amount: 18_000,
    attachmentName: "fuel-receipt.jpg",
    requesterId: "S02",
    status: "approved",
    approverId: "S15",
    decidedAt: at(-6, "16:30"),
    createdAt: at(-7, "09:00"),
  });
  req({
    kind: "job",
    title: "Service ultrasound probe",
    details: "Transvaginal probe image artefact.",
    requesterId: "S12",
    status: "approved",
    approverId: "S15",
    decidedAt: at(-10, "11:00"),
    createdAt: at(-11, "13:00"),
  });
  req({
    kind: "leave",
    title: "Annual leave (Dec)",
    details: "Two weeks in December.",
    startDate: day(60),
    endDate: day(73),
    requesterId: "S06",
    status: "rejected",
    approverId: "S15",
    comment: "Peak OCR period — please choose January dates.",
    decidedAt: at(-3, "12:00"),
    createdAt: at(-5, "08:00"),
  });
  req({
    kind: "manpower",
    title: "Extra front-desk staff (weekends)",
    details: "Weekend scans are busy.",
    requesterId: "S16",
    status: "rejected",
    approverId: "S15",
    comment: "Rotate existing staff for now.",
    decidedAt: at(-2, "15:00"),
    createdAt: at(-6, "10:30"),
  });
  data.requests
    .filter((r) => r.status !== "pending")
    .forEach((r) =>
      data.notifications.push({
        id: sid("NTF", 4),
        userId: r.requesterId,
        title: `Request ${r.status}`,
        body: `${r.title} was ${r.status} by Osaze Idemudia.`,
        href: "/requests",
        at: r.decidedAt ?? r.createdAt,
        read: false,
      }),
    );

  // ================================================================ audit log (~80 events)
  const auditEvent = (
    offset: number,
    time: string,
    actorId: string,
    action: AuditAction,
    entity: string,
    summary: string,
    entityId?: string,
  ): void => {
    data.audit.push({ id: sid("AUD"), at: at(offset, time), actorId, action, entity, entityId, summary });
  };
  const actors = ["S01", "S02", "S04", "S05", "S06", "S07", "S09", "S10", "S13", "S15", "S16", "S17"];
  const allPatients = [...hand, ...generated];
  for (let k = 0; k < 74; k += 1) {
    const offset = -13 + Math.floor(k / 5.7);
    const actor = rng.pick(actors);
    const c = rng.pick(allPatients);
    const name = `${c.female.firstName} ${c.female.lastName}`;
    const templates: [AuditAction, string, string, string | undefined][] = [
      ["view", "patient", `Opened patient file ${c.female.prn} (${name})`, c.female.id],
      ["create", "note", `Added clinical note to ${c.episode.ivfNo}`, c.episode.id],
      ["post", "procedure", `Posted procedure note for ${c.episode.ivfNo}`, c.episode.id],
      ["create", "order", `Ordered investigation for ${name}`, c.episode.id],
      ["print", "receipt", `Printed receipt for ${c.episode.ivfNo}`, c.episode.id],
      ["update", "cycle", `Updated cycle stage for ${c.episode.ivfNo}`, c.episode.id],
      ["dispense", "order", `Dispensed drugs for ${name}`, c.episode.id],
      ["export", "report", "Exported IVF patient report (CSV)", undefined],
      ["login", "session", "Signed in", undefined],
    ];
    const [action, entity, summary, entityId] = rng.pick(templates);
    auditEvent(
      Math.min(-1, offset),
      `${pad(rng.int(8, 17), 2)}:${pad(rng.int(0, 59), 2)}`,
      actor,
      action,
      entity,
      summary,
      entityId,
    );
  }
  auditEvent(-4, "13:12", "S07", "access-denied", "route", "Access denied to /billing (role: nurse)");
  auditEvent(
    -6,
    "02:40",
    "S02",
    "break-glass",
    "donor",
    "Break-glass: viewed identity of DON-F-003 during emergency recipient review",
    data.donors[2]?.id,
  );
  auditEvent(-2, "17:05", "S15", "approve", "request", "Approved request: Sick leave");
  auditEvent(-3, "12:00", "S15", "reject", "request", "Rejected request: Annual leave (Dec)");
  auditEvent(-9, "08:02", "S18", "reset", "system", "Demo data reset to seed");
  auditEvent(-1, "16:20", "S04", "sign", "embryo", `Witnessed vitrification for ${c2.episode.ivfNo}`);
  data.audit.sort((a, b) => a.at.localeCompare(b.at));

  // ================================================================ patient & family accounts
  addWalletSeed(data, at);

  return data;
}

/** A hospital that starts with no records: just its first admin user and empty registers. */
export function emptySeed(admin: { name: string; email: string; phone: string }, anchor: Date = new Date()): SeedData {
  return {
    anchor: todayIso(anchor),
    staff: [
      {
        id: "S01",
        name: admin.name,
        role: "admin",
        email: admin.email,
        phone: admin.phone,
        branchId: "BR-01",
        active: true,
      },
    ],
    persons: [],
    episodes: [],
    cycles: [],
    notes: [],
    stimulation: [],
    vitals: [],
    histories: [],
    procedures: [],
    embryos: [],
    storage: [],
    cultureLogs: [],
    custody: [],
    orders: [],
    batches: [],
    movements: [],
    charges: [],
    payments: [],
    refunds: [],
    claims: [],
    donors: [],
    surrogates: [],
    counselling: [],
    consents: [],
    requests: [],
    audit: [],
    notifications: [],
    waiting: [],
    documents: [],
    wallets: [],
    ledger: [],
    settlements: [],
    walletMessages: [],
  };
}

let cached: { day: string; data: SeedData } | null = null;

/** Memoised seed for the current day; returns a deep copy so stores never share references. */
function cachedSeed(anchor: Date): SeedData {
  const key = todayIso(anchor);
  if (!cached || cached.day !== key) cached = { day: key, data: buildSeed(anchor) };
  return cached.data;
}

export function getSeed(anchor: Date = new Date()): SeedData {
  return structuredClone(cachedSeed(anchor));
}

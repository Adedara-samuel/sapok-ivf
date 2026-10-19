/**
 * Built-in demo AI assistant.
 *
 * Deterministic and offline: questions are matched to intents and answered from the same data and selectors the
 * screens use, so numbers always agree with the dashboards. Every answer respects the signed-in role's
 * permissions, and it never gives clinical decisions (dosing, diagnosis, treatment choices).
 *
 * The answer format (blocks) is the contract a live LLM backend would return too, so the panel would not change.
 */
import { DRUG_SEED } from "@/lib/constants/catalog";
import { EPISODE_TYPE_LABELS } from "@/lib/constants/clinical";
import type { Capability } from "@/lib/permissions";
import type { Embryo } from "@/lib/schemas/embryology";
import { PREGNANT_OUTCOMES } from "@/lib/schemas/cycle";
import type { Episode } from "@/lib/schemas/episode";
import { fullName, type Person } from "@/lib/schemas/person";
import type { LedgerEntry, Settlement, Wallet } from "@/lib/schemas/wallet";
import { currentCycleFor, primaryEpisodeFor } from "@/lib/selectors/predicates";
import { availableStock } from "@/lib/selectors/stock";
import type { ClinicDb } from "@/lib/selectors/types";
import { ageYears, daysBetween, formatDate, shiftDate } from "@/lib/utils/dates";
import { formatMoney, percent } from "@/lib/utils/money";
import { isWalletPayable, walletBalance, walletForEpisode, walletOfPerson, walletTotals } from "@/lib/wallet/ledger";

export type AiBlock =
  | { type: "text"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; columns: string[]; rows: string[][] }
  | { type: "draft"; title: string; text: string }
  | { type: "links"; links: { label: string; href: string }[] };

export interface AiReply {
  intent: string;
  blocks: AiBlock[];
  refused?: boolean;
}

export interface AiData extends ClinicDb {
  wallets: Wallet[];
  entries: LedgerEntry[];
  settlements: Settlement[];
}

export interface AiContext {
  can: (capability: Capability) => boolean;
  roleLabel: string;
  userName: string;
  clinicName: string;
  today: string;
  /** The patient whose file is open, if any. */
  patientId?: string;
  /** The account (wallet) whose page is open, if any. */
  walletId?: string;
  data: AiData;
}

// ------------------------------------------------------------------ language helpers

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

const has = (q: string, ...patterns: RegExp[]) => patterns.some((p) => p.test(q));

interface Range {
  from: string;
  to: string;
  label: string;
}

export function parseRange(q: string, today: string, fallback: "month" | "year" = "month"): Range {
  const monthStart = `${today.slice(0, 7)}-01`;
  if (/\btoday\b/.test(q)) return { from: today, to: today, label: "today" };
  if (/\byesterday\b/.test(q)) {
    const y = shiftDate(today, -1);
    return { from: y, to: y, label: "yesterday" };
  }
  if (/\bthis week\b/.test(q)) return { from: shiftDate(today, -6), to: today, label: "the last 7 days" };
  if (/\blast week\b/.test(q)) return { from: shiftDate(today, -13), to: shiftDate(today, -7), label: "last week" };
  if (/\blast month\b/.test(q)) {
    const end = shiftDate(monthStart, -1);
    return { from: `${end.slice(0, 7)}-01`, to: end, label: "last month" };
  }
  const days = q.match(/\b(?:last|past) (\d{1,3}) days\b/);
  if (days) return { from: shiftDate(today, -Number(days[1]) + 1), to: today, label: `the last ${days[1]} days` };
  if (/\bthis year\b|\bytd\b/.test(q)) return { from: `${today.slice(0, 4)}-01-01`, to: today, label: "this year" };
  if (/\bthis month\b/.test(q) || fallback === "month") return { from: monthStart, to: today, label: "this month" };
  return { from: shiftDate(today, -364), to: today, label: "the last 12 months" };
}

const within = (iso: string | undefined, r: Range) =>
  Boolean(iso && iso.slice(0, 10) >= r.from && iso.slice(0, 10) <= r.to);

function denied(what: string, ctx: AiContext): AiReply {
  return {
    intent: "denied",
    refused: true,
    blocks: [
      {
        type: "text",
        text: `Your role (${ctx.roleLabel}) doesn't have access to ${what}, so I can't answer that. Ask a colleague with access, or an administrator to adjust your permissions.`,
      },
    ],
  };
}

/** Find the patient a question is about: PRN, IVF number, a name in the question, or the open file. */
export function resolvePatient(q: string, ctx: AiContext): Person | undefined {
  const { persons, episodes } = ctx.data;
  const prn = q.match(/prn-[a-z0-9]+-\d{3,6}/i)?.[0];
  if (prn) return persons.find((p) => p.prn.toLowerCase() === prn.toLowerCase());
  const ivf = q.match(/[a-z]{2,6}-\d{4}-\d{3,5}/i)?.[0];
  if (ivf) {
    const ep = episodes.find((e) => e.ivfNo.toLowerCase() === ivf.toLowerCase());
    if (ep) return persons.find((p) => p.id === ep.patientId);
  }
  const words = new Set(q.split(/[^a-z]+/).filter((w) => w.length >= 3));
  const patients = persons.filter((p) => p.roles.includes("patient"));
  const full = patients.find((p) => words.has(p.firstName.toLowerCase()) && words.has(p.lastName.toLowerCase()));
  if (full) return full;
  const byFirst = patients.filter((p) => words.has(p.firstName.toLowerCase()));
  if (byFirst.length === 1) return byFirst[0];
  if (/\b(this|the) (patient|couple|file)\b|\bher\b|\bthem\b|\bthis one\b/.test(q) || words.size <= 4)
    return persons.find((p) => p.id === ctx.patientId);
  const byLast = patients.filter((p) => words.has(p.lastName.toLowerCase()));
  if (byLast.length === 1) return byLast[0];
  return persons.find((p) => p.id === ctx.patientId);
}

function resolveWallet(q: string, ctx: AiContext): Wallet | undefined {
  const { wallets } = ctx.data;
  const code = q.match(/\b(fam|ind)-\d{4,6}\b/i)?.[0];
  if (code) return wallets.find((w) => w.code.toLowerCase() === code.toLowerCase());
  const named = wallets.find((w) => {
    const surname = w.name.toLowerCase().replace(/ (extended )?family$/, "");
    return surname.length >= 3 && q.includes(surname);
  });
  if (named) return named;
  if (ctx.walletId) return wallets.find((w) => w.id === ctx.walletId);
  const patient = resolvePatient(q, ctx);
  return walletOfPerson(wallets, patient?.id);
}

// ------------------------------------------------------------------ intents

const CLINICAL_DECISION = [
  /\b(what|which|how much|how many)\b.*\b(dose|dosage|mg|iu|units)\b/,
  /\bshould (i|we|she|he|they)\b.*\b(give|start|stop|increase|reduce|prescribe|transfer|trigger|cancel)\b/,
  /\b(prescribe|diagnose|diagnosis for|treat(ment)? plan for|recommend (a )?(drug|protocol|dose|treatment))\b/,
  /\bis (it|this) safe to\b/,
];

const HELP: AiReply = {
  intent: "help",
  blocks: [
    {
      type: "text",
      text: "I can look things up in this hospital's records and draft documents for you to review. Try:",
    },
    {
      type: "list",
      items: [
        "Summarise this patient — or “summarise Adaobi Okafor”",
        "What is pending for this patient?",
        "Draft a referral letter for this patient",
        "What is the balance of the Okafor family?",
        "Which family accounts are low on balance?",
        "Who owes us money? / overdue charges",
        "How much did we collect this month, and what were the fees?",
        "How many egg retrievals did we do last month?",
        "What is our clinical pregnancy rate this year?",
        "Who is on the waiting list today?",
        "Which drugs are low on stock or expiring?",
        "Explain embryo grade 4AA in simple words",
      ],
    },
    {
      type: "text",
      text: "I don't make clinical decisions (doses, diagnoses or treatment choices) — those stay with the treating team.",
    },
  ],
};

function patientNotFound(): AiReply {
  return {
    intent: "patient-missing",
    blocks: [
      {
        type: "text",
        text: "Which patient do you mean? Open their file, or include their full name, PRN or IVF number in the question.",
      },
    ],
  };
}

function episodeFacts(ctx: AiContext, patient: Person) {
  const { episodes, cycles, embryos, orders, charges, persons } = ctx.data;
  const episode = primaryEpisodeFor(patient.id, episodes);
  const partner = episode?.partnerId ? persons.find((p) => p.id === episode.partnerId) : undefined;
  const cycle = episode ? currentCycleFor(episode.id, cycles) : undefined;
  const cycleEmbryos: Embryo[] = cycle ? embryos.filter((e) => e.cycleId === cycle.id) : [];
  const allCycleIds = new Set(cycles.filter((c) => c.episodeId === episode?.id).map((c) => c.id));
  const frozen = embryos.filter((e) => allCycleIds.has(e.cycleId) && e.status === "cryopreserved").length;
  const pendingOrders = orders.filter(
    (o) => o.episodeId === episode?.id && (o.status === "ordered" || o.status === "in-progress"),
  );
  const outstanding = charges
    .filter((c) => c.episodeId === episode?.id && c.status !== "waived")
    .reduce((s, c) => s + c.amount - c.paid, 0);
  return { episode, partner, cycle, cycleEmbryos, frozen, pendingOrders, outstanding };
}

function staffName(ctx: AiContext, id: string | undefined) {
  return ctx.data.staff.find((s) => s.id === id)?.name ?? "—";
}

function summarise(q: string, ctx: AiContext): AiReply {
  if (!ctx.can("patients.view")) return denied("patient records", ctx);
  const patient = resolvePatient(q, ctx);
  if (!patient) return patientNotFound();
  const f = episodeFacts(ctx, patient);
  const blocks: AiBlock[] = [];
  blocks.push({
    type: "text",
    text: `${fullName(patient, true)}, ${ageYears(patient.dob)} years (${patient.prn}).${f.episode ? ` ${f.episode.ivfNo} · ${EPISODE_TYPE_LABELS[f.episode.type]} with ${staffName(ctx, f.episode.doctorId)}, opened ${formatDate(f.episode.openedAt)} (${f.episode.status}).` : " No treatment episode yet."}${f.partner ? ` Partner: ${fullName(f.partner)}, ${ageYears(f.partner.dob)} years.` : ""}`,
  });
  if (ctx.can("clinical.view") && f.episode) {
    const items: string[] = [];
    if (f.episode.diagnosis.length) items.push(`Diagnosis: ${f.episode.diagnosis.join(", ")}`);
    if (patient.allergies.length) items.push(`⚠ Allergies: ${patient.allergies.join(", ")}`);
    if (f.cycle) {
      items.push(
        `Cycle ${f.cycle.number} (${f.cycle.kind}, ${f.cycle.protocol}) — stage: ${f.cycle.stage.replace(/-/g, " ")}, started ${formatDate(f.cycle.startDate)}`,
      );
      if (f.cycle.ocr)
        items.push(
          `Egg retrieval: ${f.cycle.ocr.eggs} eggs, ${f.cycle.ocr.mii} mature, ${f.cycle.ocr.fertilised} fertilised`,
        );
      if (f.cycleEmbryos.length)
        items.push(
          `Embryos this cycle: ${f.cycleEmbryos.length} (${f.cycleEmbryos.filter((e) => e.status === "culturing").length} in culture, ${f.cycleEmbryos.filter((e) => e.status === "cryopreserved").length} frozen, ${f.cycleEmbryos.filter((e) => e.status === "transferred").length} transferred)`,
        );
      if (f.cycle.transferPlan) items.push(`Transfer planned ${formatDate(f.cycle.transferPlan.date)}`);
      if (f.cycle.betaHcg)
        items.push(
          f.cycle.betaHcg.value !== undefined
            ? `Beta-hCG ${f.cycle.betaHcg.value} IU/L on ${formatDate(f.cycle.betaHcg.date)}`
            : `Pregnancy test due ${formatDate(f.cycle.betaHcg.date)}`,
        );
      if (f.cycle.outcome !== "pending") items.push(`Outcome: ${f.cycle.outcome.replace(/-/g, " ")}`);
    }
    if (f.frozen) items.push(`${f.frozen} embryo(s) in cryo-storage across all cycles`);
    if (f.pendingOrders.length) items.push(`Pending orders: ${f.pendingOrders.map((o) => o.name).join(", ")}`);
    if (items.length) blocks.push({ type: "list", items });
  } else if (f.episode) {
    blocks.push({ type: "text", text: "Clinical details are hidden for your role." });
  }
  if (ctx.can("billing.view") || ctx.can("wallets.view")) {
    const wallet = f.episode
      ? walletForEpisode(ctx.data.wallets, f.episode)
      : walletOfPerson(ctx.data.wallets, patient.id);
    const money: string[] = [];
    if (f.episode)
      money.push(
        f.outstanding > 0
          ? `Outstanding on ${f.episode.ivfNo}: ${formatMoney(f.outstanding)}`
          : `${f.episode.ivfNo} account is settled`,
      );
    if (wallet)
      money.push(
        `Pays from ${wallet.name} (${wallet.code}) — available ${formatMoney(walletBalance(ctx.data.entries, wallet.id) + wallet.creditLimit)}, auto-debit ${wallet.autoDebit ? "on" : "off"}`,
      );
    else money.push("Not linked to a patient or family account yet");
    blocks.push({ type: "list", items: money });
  }
  const links = [{ label: "Open patient file", href: `/patients/${patient.id}` }];
  const wallet =
    walletOfPerson(ctx.data.wallets, patient.id) ??
    (f.episode ? walletForEpisode(ctx.data.wallets, f.episode) : undefined);
  if (wallet && ctx.can("wallets.view")) links.push({ label: `Open ${wallet.name}`, href: `/accounts/${wallet.id}` });
  blocks.push({ type: "links", links });
  return { intent: "summary", blocks };
}

function pending(q: string, ctx: AiContext): AiReply {
  if (!ctx.can("clinical.view")) return denied("clinical records", ctx);
  const patient = resolvePatient(q, ctx);
  if (!patient) return patientNotFound();
  const f = episodeFacts(ctx, patient);
  if (!f.episode)
    return {
      intent: "pending",
      blocks: [{ type: "text", text: `${fullName(patient)} has no open episode, so nothing is pending.` }],
    };
  const items: string[] = [];
  f.pendingOrders.forEach((o) =>
    items.push(
      `${o.kind === "pharmacy" ? "Prescription to dispense" : "Awaiting result"}: ${o.name} (ordered ${formatDate(o.at)})`,
    ),
  );
  if (f.cycle?.transferPlan && f.cycle.transferPlan.date >= ctx.today)
    items.push(`Embryo transfer on ${formatDate(f.cycle.transferPlan.date)}`);
  if (f.cycle?.betaHcg && f.cycle.betaHcg.value === undefined)
    items.push(`Pregnancy test (beta-hCG) due ${formatDate(f.cycle.betaHcg.date)}`);
  if (ctx.can("billing.view") && f.outstanding > 0) items.push(`Unpaid charges: ${formatMoney(f.outstanding)}`);
  return {
    intent: "pending",
    blocks: [
      { type: "text", text: `Open items for ${fullName(patient)} (${f.episode.ivfNo}):` },
      items.length
        ? { type: "list", items }
        : { type: "text", text: "Nothing is pending — no open orders, tests or unpaid charges." },
      { type: "links", links: [{ label: "Open patient file", href: `/patients/${patient.id}` }] },
    ],
  };
}

function draftLetter(q: string, ctx: AiContext): AiReply {
  if (!ctx.can("clinical.view")) return denied("clinical records needed for letters", ctx);
  const patient = resolvePatient(q, ctx);
  if (!patient) return patientNotFound();
  const f = episodeFacts(ctx, patient);
  const kind = /\bdischarge\b/.test(q)
    ? "discharge"
    : /\b(patient|couple|instruction)\b.*\bletter\b|\bletter to (the )?(patient|couple)\b/.test(q)
      ? "patient"
      : "referral";
  const lines: string[] = [];
  lines.push(ctx.clinicName, formatDate(ctx.today), "");
  if (kind === "patient") {
    lines.push(`Dear ${fullName(patient, true)}${f.partner ? ` and ${fullName(f.partner, true)}` : ""},`, "");
    lines.push(
      `Thank you for choosing ${ctx.clinicName}. This letter summarises where you are in treatment${f.episode ? ` (${f.episode.ivfNo}, ${EPISODE_TYPE_LABELS[f.episode.type]})` : ""}.`,
    );
    if (f.cycle) lines.push(`Your current cycle is at the ${f.cycle.stage.replace(/-/g, " ")} stage.`);
    if (f.cycle?.transferPlan)
      lines.push(`Your embryo transfer is planned for ${formatDate(f.cycle.transferPlan.date)}.`);
    if (f.cycle?.betaHcg && f.cycle.betaHcg.value === undefined)
      lines.push(`Please come for your pregnancy blood test on ${formatDate(f.cycle.betaHcg.date)}.`);
    lines.push("", "If you have any questions, please call the clinic.", "");
  } else {
    lines.push("Dear Colleague,", "");
    lines.push(
      `Re: ${fullName(patient, true)}, DOB ${formatDate(patient.dob)} (${ageYears(patient.dob)} years), ${patient.prn}${f.episode ? `, ${f.episode.ivfNo}` : ""}`,
      "",
    );
    lines.push(
      kind === "discharge"
        ? `${fullName(patient, true)} has completed this episode of fertility treatment at ${ctx.clinicName}.`
        : `I would be grateful if you could see ${fullName(patient, true)}, who is under our care for fertility treatment.`,
    );
    if (f.episode?.diagnosis.length) lines.push(`Diagnosis: ${f.episode.diagnosis.join(", ")}.`);
    if (f.episode)
      lines.push(`Treatment: ${EPISODE_TYPE_LABELS[f.episode.type]} under ${staffName(ctx, f.episode.doctorId)}.`);
    if (f.cycle)
      lines.push(
        `Current cycle ${f.cycle.number}: ${f.cycle.protocol} protocol, stage ${f.cycle.stage.replace(/-/g, " ")}${f.cycle.ocr ? `; ${f.cycle.ocr.eggs} eggs retrieved, ${f.cycle.ocr.fertilised} fertilised` : ""}.`,
      );
    if (f.frozen) lines.push(`${f.frozen} embryo(s) remain in cryo-storage.`);
    if (patient.allergies.length) lines.push(`Allergies: ${patient.allergies.join(", ")}.`);
    lines.push("", "[Add the reason for referral and the specific question here.]", "");
  }
  lines.push("Yours sincerely,", "", ctx.userName, ctx.clinicName);
  return {
    intent: "draft",
    blocks: [
      {
        type: "draft",
        title:
          kind === "patient" ? "Letter to the patient" : kind === "discharge" ? "Discharge summary" : "Referral letter",
        text: lines.join("\n"),
      },
      { type: "text", text: "Review and edit before sending — check every clinical detail against the file." },
    ],
  };
}

const EXPANSION: Record<string, string> = {
  "1": "an early blastocyst — the fluid cavity is just starting to form",
  "2": "a blastocyst whose cavity fills about half the embryo",
  "3": "a full blastocyst — the cavity fills the whole embryo",
  "4": "an expanded blastocyst — it has grown and its shell has thinned",
  "5": "a hatching blastocyst — it is starting to break out of its shell",
  "6": "a hatched blastocyst — it has fully left its shell",
};
const QUALITY: Record<string, string> = {
  a: "excellent (many tightly packed cells)",
  b: "good (several loosely grouped cells)",
  c: "fair (few cells)",
};

function explainGrade(q: string): AiReply {
  const m = q.match(/\b([1-6])\s?([abc])\s?([abc])\b/);
  if (!m) {
    return {
      intent: "grade",
      blocks: [
        {
          type: "text",
          text: "Blastocysts are graded with a number and two letters, e.g. 4AA. The number (1–6) is how far the embryo has developed and expanded; the first letter is the inner cell mass (which becomes the baby) and the second the outer layer (which becomes the placenta), each A (best) to C. Ask me about a specific grade, e.g. “explain 4AB”.",
        },
      ],
    };
  }
  const [, n, icm, te] = m as unknown as [string, string, string, string];
  const grade = `${n}${icm}${te}`.toUpperCase();
  return {
    intent: "grade",
    blocks: [
      { type: "text", text: `In plain words, a ${grade} embryo is:` },
      {
        type: "list",
        items: [
          `${n} — ${EXPANSION[n]}.`,
          `${icm.toUpperCase()} (inner cell mass, the part that becomes the baby) — ${QUALITY[icm]}.`,
          `${te.toUpperCase()} (outer layer, the part that becomes the placenta) — ${QUALITY[te]}.`,
        ],
      },
      {
        type: "text",
        text: "Grades describe how an embryo looks under the microscope on that day. They help the embryologist choose which embryo to transfer first, but they are not a guarantee — lower-graded embryos also lead to healthy pregnancies.",
      },
    ],
  };
}

function walletBalanceReply(q: string, ctx: AiContext): AiReply {
  if (!ctx.can("wallets.view") && !ctx.can("billing.view")) return denied("patient and family accounts", ctx);
  const wallet = resolveWallet(q, ctx);
  if (!wallet) {
    const patient = resolvePatient(q, ctx);
    return {
      intent: "balance",
      blocks: [
        {
          type: "text",
          text: patient
            ? `${fullName(patient)} is not linked to any patient or family account yet. Open their file → Billing to create or link one.`
            : "Which account? Include the family name (e.g. “Okafor family”), the account code (FAM-000001) or a patient's name.",
        },
      ],
    };
  }
  const t = walletTotals(ctx.data.entries, wallet.id);
  const memberIds = new Set(wallet.members.map((m) => m.personId));
  const episodeIds = new Set(
    ctx.data.episodes.filter((e) => walletForEpisode(ctx.data.wallets, e)?.id === wallet.id).map((e) => e.id),
  );
  const owed = ctx.data.charges
    .filter((c) => episodeIds.has(c.episodeId) && isWalletPayable(c))
    .reduce((s, c) => s + c.amount - c.paid, 0);
  return {
    intent: "balance",
    blocks: [
      {
        type: "text",
        text: `${wallet.name} (${wallet.code}) has a balance of ${formatMoney(t.balance)}${wallet.creditLimit ? ` with a credit limit of ${formatMoney(wallet.creditLimit)} (available ${formatMoney(t.balance + wallet.creditLimit)})` : ""}. Auto-debit is ${wallet.autoDebit ? "on" : "off"}.`,
      },
      {
        type: "table",
        columns: ["", "Amount"],
        rows: [
          ["Total received", formatMoney(t.received)],
          ["Spent on charges", formatMoney(t.spent)],
          ["Returned from cancelled items", formatMoney(t.returned)],
          ["Refunded to the family", formatMoney(t.withdrawn)],
          ["Balance", formatMoney(t.balance)],
          ["Unpaid charges waiting", formatMoney(owed)],
        ],
      },
      {
        type: "text",
        text: `${memberIds.size} member(s): ${wallet.members
          .map((m) => {
            const p = ctx.data.persons.find((x) => x.id === m.personId);
            return p ? `${fullName(p)} (${m.relationship})` : m.personId;
          })
          .join(
            ", ",
          )}.${wallet.virtualAccount ? ` Pays by transfer to ${wallet.virtualAccount.bankName} ${wallet.virtualAccount.accountNumber}.` : " No account number issued yet (needs the holder's BVN)."}`,
      },
      { type: "links", links: [{ label: `Open ${wallet.name}`, href: `/accounts/${wallet.id}` }] },
    ],
  };
}

function lowBalances(ctx: AiContext): AiReply {
  if (!ctx.can("wallets.view")) return denied("patient and family accounts", ctx);
  const rows = ctx.data.wallets
    .filter((w) => w.status === "active")
    .map((w) => ({ w, balance: walletBalance(ctx.data.entries, w.id) }))
    .filter(({ w, balance }) => balance <= 0 || (w.lowBalanceAlert > 0 && balance < w.lowBalanceAlert))
    .sort((a, b) => a.balance - b.balance);
  if (rows.length === 0)
    return { intent: "low-balance", blocks: [{ type: "text", text: "No account is below its low-balance alert. 👍" }] };
  return {
    intent: "low-balance",
    blocks: [
      { type: "text", text: `${rows.length} account(s) need a top-up:` },
      {
        type: "table",
        columns: ["Account", "Balance", "Alert level", "Credit limit"],
        rows: rows.map(({ w, balance }) => [
          `${w.name} (${w.code})`,
          formatMoney(balance),
          formatMoney(w.lowBalanceAlert),
          formatMoney(w.creditLimit),
        ]),
      },
      { type: "links", links: [{ label: "Open accounts", href: "/accounts?filter=low" }] },
    ],
  };
}

function debtors(q: string, ctx: AiContext): AiReply {
  if (!ctx.can("billing.view")) return denied("billing", ctx);
  const overdueDays = Number(q.match(/(\d{1,3})\s*days?/)?.[1] ?? (/\boverdue\b|\bold\b|\baged?\b/.test(q) ? 30 : 0));
  const rows = ctx.data.episodes
    .map((e) => {
      const due = ctx.data.charges
        .filter((c) => c.episodeId === e.id && c.status !== "waived" && daysBetween(c.at, ctx.today) >= overdueDays)
        .reduce((s, c) => s + c.amount - c.paid, 0);
      return { e, due, patient: ctx.data.persons.find((p) => p.id === e.patientId) };
    })
    .filter((r) => r.due > 0)
    .sort((a, b) => b.due - a.due);
  const total = rows.reduce((s, r) => s + r.due, 0);
  return {
    intent: "debtors",
    blocks: [
      {
        type: "text",
        text: rows.length
          ? `${rows.length} account(s) owe ${formatMoney(total)}${overdueDays ? ` on charges older than ${overdueDays} days` : ""}. Top ${Math.min(8, rows.length)}:`
          : `No unpaid charges${overdueDays ? ` older than ${overdueDays} days` : ""}.`,
      },
      ...(rows.length
        ? [
            {
              type: "table" as const,
              columns: ["Patient", "IVF no", "Payer", "Owed"],
              rows: rows
                .slice(0, 8)
                .map((r) => [
                  r.patient ? fullName(r.patient) : "—",
                  r.e.ivfNo,
                  r.patient?.payer.category ?? "—",
                  formatMoney(r.due),
                ]),
            },
            { type: "links" as const, links: [{ label: "Open aged debtors", href: "/billing?tab=aging" }] },
          ]
        : []),
    ],
  };
}

function collections(q: string, ctx: AiContext): AiReply {
  if (!ctx.can("reports.finance")) return denied("financial reports", ctx);
  const r = parseRange(q, ctx.today);
  const payments = ctx.data.payments.filter((p) => within(p.at, r));
  const desk = payments.filter((p) => p.method !== "wallet").reduce((s, p) => s + p.amount, 0);
  const fromAccounts = payments.filter((p) => p.method === "wallet").reduce((s, p) => s + p.amount, 0);
  const deposits = ctx.data.settlements.filter((s) => within(s.at, r));
  const sum = (k: "gross" | "gatewayFee" | "platformFee" | "hospitalNet") => deposits.reduce((s, x) => s + x[k], 0);
  return {
    intent: "collections",
    blocks: [
      { type: "text", text: `Money in ${r.label} (${formatDate(r.from)} – ${formatDate(r.to)}):` },
      {
        type: "table",
        columns: ["", "Amount"],
        rows: [
          ["Deposits into patient & family accounts", formatMoney(sum("gross"))],
          ["  − Gateway fees (Paystack)", formatMoney(sum("gatewayFee"))],
          ["  − Platform service charge", formatMoney(sum("platformFee"))],
          ["  = Settled to the hospital's bank", formatMoney(sum("hospitalNet"))],
          ["Charges paid from accounts", formatMoney(fromAccounts)],
          ["Payments taken directly at the desk / HMO", formatMoney(desk)],
        ],
      },
      {
        type: "text",
        text: "Patients are always credited the full amount they pay; fees come out of the hospital's settlement.",
      },
      { type: "links", links: [{ label: "Open collections & settlements", href: "/billing?tab=settlements" }] },
    ],
  };
}

const PROCEDURE_WORDS: { re: RegExp; types: string[]; label: string }[] = [
  { re: /egg (retrieval|collection)s?|\bocr\b|oocyte (retrieval|pick ?up)/, types: ["OCR"], label: "egg retrievals" },
  { re: /frozen (embryo )?transfers?|\bfet\b/, types: ["FET"], label: "frozen embryo transfers" },
  { re: /(embryo )?transfers?|\bet\b/, types: ["ET", "FET"], label: "embryo transfers (fresh + frozen)" },
  { re: /\bpgt\b|biops/, types: ["PGT", "BIOPSY"], label: "PGT biopsies" },
  {
    re: /procedures?/,
    types: ["OCR", "PRP", "CYST_DRAINAGE", "PGT", "ET", "FET", "ANDROLOGY", "BIOPSY"],
    label: "procedures",
  },
];

function procedureCount(q: string, ctx: AiContext): AiReply | null {
  const match = PROCEDURE_WORDS.find((p) => p.re.test(q));
  if (!match) return null;
  if (!ctx.can("reports.view") && !ctx.can("clinical.view")) return denied("clinical activity reports", ctx);
  const r = parseRange(q, ctx.today);
  const rows = ctx.data.procedures.filter(
    (p) => p.status === "posted" && match.types.includes(p.type) && within(p.date, r),
  );
  const byType = match.types.map((t) => [t, rows.filter((p) => p.type === t).length] as const).filter(([, n]) => n > 0);
  return {
    intent: "procedure-count",
    blocks: [
      {
        type: "text",
        text: `${rows.length} ${match.label} were posted ${r.label} (${formatDate(r.from)} – ${formatDate(r.to)}).`,
      },
      ...(byType.length > 1 ? [{ type: "list" as const, items: byType.map(([t, n]) => `${t}: ${n}`) }] : []),
    ],
  };
}

function pregnancyRate(q: string, ctx: AiContext): AiReply {
  if (!ctx.can("reports.view")) return denied("outcome reports", ctx);
  const r = parseRange(q, ctx.today, "year");
  const cycles = ctx.data.cycles.filter(
    (c) => (c.ocr || c.transferPlan) && c.startDate >= r.from && c.startDate <= r.to,
  );
  const decided = cycles.filter(
    (c) => (c.transferPlan?.embryoIds.length ?? 0) > 0 && c.outcome !== "pending" && c.outcome !== "cancelled",
  );
  const pregnant = decided.filter((c) => PREGNANT_OUTCOMES.includes(c.outcome));
  const live = decided.filter((c) => c.outcome === "live-birth");
  return {
    intent: "pregnancy-rate",
    blocks: [
      {
        type: "text",
        text: decided.length
          ? `For cycles started ${r.label}: clinical pregnancy rate ${percent(pregnant.length, decided.length)}% (${pregnant.length} of ${decided.length} transfers with a known outcome); live birth ${percent(live.length, decided.length)}%.`
          : `No transfers with a known outcome for cycles started ${r.label} yet.`,
      },
      { type: "text", text: "Same rules as Reports → Success rates (transfers with a decided outcome only)." },
      { type: "links", links: [{ label: "Open success-rate report", href: "/reports" }] },
    ],
  };
}

function waitingToday(ctx: AiContext): AiReply {
  if (!ctx.can("waiting.view")) return denied("the waiting list", ctx);
  const rows = ctx.data.waiting.filter((w) => w.date === ctx.today).sort((a, b) => a.time.localeCompare(b.time));
  return {
    intent: "waiting",
    blocks: [
      {
        type: "text",
        text: rows.length ? `${rows.length} patient(s) on today's list:` : "Nobody is on today's waiting list yet.",
      },
      ...(rows.length
        ? [
            {
              type: "table" as const,
              columns: ["Time", "Patient", "Purpose", "Status"],
              rows: rows.map((w) => {
                const p = ctx.data.persons.find((x) => x.id === w.personId);
                return [w.time, p ? fullName(p) : "—", w.purpose, w.status.replace(/-/g, " ")];
              }),
            },
            { type: "links" as const, links: [{ label: "Open waiting list", href: "/waiting-list" }] },
          ]
        : []),
    ],
  };
}

function stock(ctx: AiContext): AiReply {
  if (!ctx.can("pharmacy.view")) return denied("pharmacy stock", ctx);
  const soon = shiftDate(ctx.today, 60);
  const low = DRUG_SEED.map((d) => ({ d, avail: availableStock(ctx.data.batches, d.code, ctx.today) })).filter(
    (x) => x.avail < x.d.reorderLevel,
  );
  const expiring = ctx.data.batches.filter((b) => b.qty > 0 && b.expiry >= ctx.today && b.expiry <= soon);
  const name = (code: string) => DRUG_SEED.find((d) => d.code === code)?.name ?? code;
  return {
    intent: "stock",
    blocks: [
      {
        type: "text",
        text: `${low.length} drug(s) are below their reorder level and ${expiring.length} batch(es) expire within 60 days.`,
      },
      ...(low.length
        ? [
            {
              type: "list" as const,
              items: low.map((x) => `Low: ${x.d.name} — ${x.avail} left (reorder at ${x.d.reorderLevel})`),
            },
          ]
        : []),
      ...(expiring.length
        ? [
            {
              type: "list" as const,
              items: expiring.map(
                (b) => `Expiring: ${name(b.code)} batch ${b.batchNo} — ${b.qty} units, ${formatDate(b.expiry)}`,
              ),
            },
          ]
        : []),
      { type: "links", links: [{ label: "Open pharmacy stock", href: "/pharmacy?tab=stock" }] },
    ],
  };
}

function cryoConsents(ctx: AiContext): AiReply {
  if (!ctx.can("embryology.view")) return denied("cryo-storage", ctx);
  const soon = shiftDate(ctx.today, 45);
  const rows = ctx.data.storage
    .filter((s) => s.consentExpiry <= soon)
    .sort((a, b) => a.consentExpiry.localeCompare(b.consentExpiry));
  return {
    intent: "cryo",
    blocks: [
      {
        type: "text",
        text: rows.length
          ? `${rows.length} stored item(s) have storage consent expired or expiring within 45 days:`
          : "No storage consents expire in the next 45 days.",
      },
      ...(rows.length
        ? [
            {
              type: "table" as const,
              columns: ["Item", "Consent expiry", "Status"],
              rows: rows.map((s) => [
                s.label,
                formatDate(s.consentExpiry),
                s.consentExpiry < ctx.today ? "Expired" : "Expiring",
              ]),
            },
          ]
        : []),
      { type: "links", links: [{ label: "Open cryo map", href: "/embryology?tab=cryo" }] },
    ],
  };
}

function approvals(ctx: AiContext): AiReply {
  if (!ctx.can("requests.approve")) return denied("approvals", ctx);
  const rows = ctx.data.requests.filter((r) => r.status === "pending");
  return {
    intent: "approvals",
    blocks: [
      {
        type: "text",
        text: rows.length ? `${rows.length} request(s) await approval:` : "Nothing is waiting for approval.",
      },
      ...(rows.length
        ? [
            {
              type: "list" as const,
              items: rows.map((r) => `${r.title}${r.amount ? ` — ${formatMoney(r.amount)}` : ""}`),
            },
          ]
        : []),
      { type: "links", links: [{ label: "Open approvals", href: "/requests?tab=approvals" }] },
    ],
  };
}

function counts(ctx: AiContext): AiReply {
  if (!ctx.can("patients.view")) return denied("patient records", ctx);
  const open = ctx.data.episodes.filter((e: Episode) => e.status === "open").length;
  const active = ctx.data.cycles.filter((c) => c.stage !== "completed" && c.stage !== "cancelled").length;
  const patients = ctx.data.persons.filter((p) => p.roles.includes("patient")).length;
  return {
    intent: "counts",
    blocks: [
      {
        type: "text",
        text: `${patients} registered patients, ${open} open treatment episodes and ${active} active cycles.`,
      },
    ],
  };
}

// ------------------------------------------------------------------ entry point

export function askAssistant(question: string, ctx: AiContext): AiReply {
  const q = norm(question);
  if (q.length < 2) return HELP;
  if (has(q, ...CLINICAL_DECISION))
    return {
      intent: "clinical-decision",
      refused: true,
      blocks: [
        {
          type: "text",
          text: "I can't advise on doses, diagnoses or treatment decisions — those must come from the treating doctor using the full clinical picture. I can summarise the file, show the stimulation history or draft a note for the doctor to review.",
        },
      ],
    };
  if (has(q, /^(hi|hello|hey|help|what can you do|\?)/, /\bwhat can you\b/)) return HELP;
  if (has(q, /\b(draft|write|prepare|compose)\b.*\b(letter|referral|summary|note)\b/, /\breferral letter\b/))
    return draftLetter(q, ctx);
  if (has(q, /\b[1-6]\s?[abc]\s?[abc]\b/, /\bembryo grad/, /\bgrade\b.*\bmean/, /\bexplain\b.*\bgrade/))
    return explainGrade(q);
  if (has(q, /\blow (on )?balance\b|\brunning low\b|\bneed(s)? (a )?top.?up\b|\btop.?ups?\b/)) return lowBalances(ctx);
  if (has(q, /\b(balance|wallet|account number|family account|account)\b/) && !has(q, /\bcollect|\brevenue|\bfees?\b/))
    return walletBalanceReply(q, ctx);
  if (has(q, /\bsummar|\boverview\b|\btell me about\b|\bhistory of\b|\bwho is\b/)) return summarise(q, ctx);
  if (has(q, /\bpending\b|\bnext steps?\b|\bwhat'?s next\b|\boutstanding (tests|orders|items)\b/))
    return pending(q, ctx);
  if (has(q, /\bowe|\bdebtor|\bunpaid\b|\boverdue\b|\boutstanding\b|\baged\b/)) return debtors(q, ctx);
  if (has(q, /\bcollect|\brevenue\b|\bincome\b|\bfees?\b|\bsettle|\bmoney (in|came)\b|\bdeposits?\b/))
    return collections(q, ctx);
  if (has(q, /\bpregnan|\bsuccess rate|\blive birth/)) return pregnancyRate(q, ctx);
  if (has(q, /\bhow many\b|\bcount\b|\bnumber of\b/)) {
    const procedures = procedureCount(q, ctx);
    if (procedures) return procedures;
    if (has(q, /\bpatients?\b|\bcycles?\b|\bepisodes?\b/)) return counts(ctx);
  }
  if (has(q, /\bwaiting\b|\bqueue\b|\bwho is (here|in)\b|\bappointments? today\b/)) return waitingToday(ctx);
  if (has(q, /\bstock\b|\bexpir(ing|y|e)\b.*\b(drug|batch|stock)|\b(drug|drugs|medication)s?\b.*\b(low|expir)/))
    return stock(ctx);
  if (has(q, /\bcryo\b|\bstorage consent|\bfrozen\b.*\bconsent/)) return cryoConsents(ctx);
  if (has(q, /\bapprov|\brequests?\b.*\bwaiting\b/)) return approvals(ctx);
  const procedures = procedureCount(q, ctx);
  if (procedures) return procedures;
  if (resolvePatient(q, ctx) && q.split(" ").length <= 4) return summarise(q, ctx);
  return {
    intent: "unknown",
    blocks: [
      { type: "text", text: "I'm not sure how to answer that yet. Here is what I can help with:" },
      ...(HELP.blocks.slice(1, 2) as AiBlock[]),
    ],
  };
}

/** Starter questions for the page the user is on. */
export function suggestionsFor(ctx: Pick<AiContext, "can" | "patientId" | "walletId">, pathname: string): string[] {
  const s: string[] = [];
  if (ctx.patientId) {
    s.push("Summarise this patient");
    if (ctx.can("clinical.view"))
      s.push("What is pending for this patient?", "Draft a referral letter for this patient");
    if (ctx.can("wallets.view")) s.push("What is this patient's account balance?");
  } else if (ctx.walletId) {
    s.push("What is the balance of this account?", "Which family accounts are low on balance?");
  } else if (pathname.startsWith("/billing") || pathname.startsWith("/accounts")) {
    if (ctx.can("reports.finance")) s.push("How much did we collect this month, and what were the fees?");
    s.push("Which family accounts are low on balance?", "Who owes us money over 30 days?");
  } else if (pathname.startsWith("/pharmacy")) {
    s.push("Which drugs are low on stock or expiring?");
  } else if (pathname.startsWith("/embryology")) {
    s.push("Explain embryo grade 4AB in simple words", "Which storage consents are expiring?");
  } else {
    if (ctx.can("waiting.view")) s.push("Who is on the waiting list today?");
    if (ctx.can("reports.view"))
      s.push("How many egg retrievals did we do last month?", "What is our clinical pregnancy rate this year?");
    if (ctx.can("billing.view")) s.push("Who owes us money over 30 days?");
  }
  if (s.length < 3) s.push("Explain embryo grade 4AA in simple words");
  return s.slice(0, 4);
}

import { beforeAll, describe, expect, it } from "vitest";
import { askAssistant, parseRange, type AiBlock, type AiContext } from "@/lib/ai/assistant";
import { DEFAULT_ROLE_CAPABILITIES, hasCapability, type Capability } from "@/lib/permissions";
import type { StaffRole } from "@/lib/schemas/admin";
import { buildSeed } from "@/lib/seed/build";
import type { SeedData } from "@/lib/seed/types";
import { walletBalance } from "@/lib/wallet/ledger";
import { formatMoney } from "@/lib/utils/money";

const ANCHOR = new Date("2026-10-08T10:30:00+01:00");
let seed: SeedData;

beforeAll(() => {
  seed = buildSeed(ANCHOR);
});

function ctx(role: StaffRole, extra: Partial<AiContext> = {}): AiContext {
  return {
    can: (c: Capability) => hasCapability(DEFAULT_ROLE_CAPABILITIES, role, c),
    roleLabel: role,
    userName: "Dr. Test User",
    clinicName: "Overcare IVF",
    today: seed.anchor,
    data: { ...seed, entries: seed.ledger },
    ...extra,
  };
}

const text = (blocks: AiBlock[]) =>
  blocks
    .map((b) =>
      b.type === "text"
        ? b.text
        : b.type === "list"
          ? b.items.join("\n")
          : b.type === "table"
            ? b.rows.map((r) => r.join(" ")).join("\n")
            : b.type === "draft"
              ? b.text
              : b.links.map((l) => l.label).join(" "),
    )
    .join("\n");

describe("AI assistant", () => {
  it("never gives clinical decisions", () => {
    for (const q of [
      "What dose of Gonal-F should I give her?",
      "Should we trigger tonight?",
      "Prescribe something for her pain",
    ]) {
      const r = askAssistant(q, ctx("doctor"));
      expect({ q, refused: r.refused, intent: r.intent }).toEqual({ q, refused: true, intent: "clinical-decision" });
    }
  });

  it("respects the role's permissions", () => {
    expect(askAssistant("Who owes us money?", ctx("nurse")).refused).toBe(true);
    expect(askAssistant("How much did we collect this month?", ctx("doctor")).refused).toBe(true);
    expect(askAssistant("How much did we collect this month?", ctx("accountant")).refused).toBeFalsy();
    expect(askAssistant("Which drugs are low on stock?", ctx("pharmacist")).refused).toBeFalsy();
  });

  it("summarises a patient by name, hiding clinical detail from non-clinical roles", () => {
    const doctor = text(askAssistant("Summarise Adaobi Okafor", ctx("doctor")).blocks);
    expect(doctor).toMatch(/Adaobi Okafor/);
    expect(doctor).toMatch(/Cycle 2/);
    const desk = text(askAssistant("Summarise Adaobi Okafor", ctx("frontdesk")).blocks);
    expect(desk).toMatch(/Adaobi Okafor/);
    expect(desk).toMatch(/hidden for your role/);
    expect(desk).not.toMatch(/Cycle 2/);
  });

  it("uses the open patient file when no name is given", () => {
    const adaobi = seed.persons.find((p) => p.firstName === "Adaobi");
    const r = askAssistant("What is pending for this patient?", ctx("doctor", { patientId: adaobi?.id }));
    expect(r.intent).toBe("pending");
    expect(text(r.blocks)).toMatch(/Adaobi Okafor/);
  });

  it("reports an account balance that matches the ledger", () => {
    const w = seed.wallets.find((x) => x.name === "Okafor Family");
    if (!w) throw new Error("no wallet");
    const r = askAssistant("What is the balance of the Okafor family?", ctx("accountant"));
    expect(r.intent).toBe("balance");
    expect(text(r.blocks)).toContain(formatMoney(walletBalance(seed.ledger, w.id)));
  });

  it("lists low-balance accounts", () => {
    const r = askAssistant("Which family accounts are low on balance?", ctx("accountant"));
    expect(r.intent).toBe("low-balance");
    expect(text(r.blocks)).toMatch(/Musa Family/);
  });

  it("counts posted egg retrievals exactly like the procedure records", () => {
    const range = parseRange("last month", seed.anchor);
    const expected = seed.procedures.filter(
      (p) => p.status === "posted" && p.type === "OCR" && p.date >= range.from && p.date <= range.to,
    ).length;
    const r = askAssistant("How many egg retrievals did we do last month?", ctx("doctor"));
    expect(r.intent).toBe("procedure-count");
    expect(text(r.blocks)).toMatch(new RegExp(`^${expected} egg retrievals`));
  });

  it("drafts an editable referral letter with the clinic and patient", () => {
    const r = askAssistant("Draft a referral letter for Adaobi Okafor", ctx("doctor"));
    const draft = r.blocks.find((b) => b.type === "draft");
    expect(draft?.type).toBe("draft");
    expect(draft && draft.type === "draft" ? draft.text : "").toMatch(
      /Overcare IVF[\s\S]*Adaobi Okafor[\s\S]*Dr\. Test User/,
    );
  });

  it("explains embryo grades in plain language", () => {
    const r = askAssistant("explain 4AB", ctx("nurse"));
    expect(r.intent).toBe("grade");
    expect(text(r.blocks)).toMatch(/expanded blastocyst/);
  });

  it("parses common date ranges", () => {
    expect(parseRange("last month", "2026-10-08")).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
    expect(parseRange("today", "2026-10-08")).toMatchObject({ from: "2026-10-08", to: "2026-10-08" });
    expect(parseRange("past 7 days", "2026-10-08")).toMatchObject({ from: "2026-10-02", to: "2026-10-08" });
  });

  it("falls back to help for questions it doesn't understand", () => {
    expect(askAssistant("what's the weather in Abuja", ctx("doctor")).intent).toBe("unknown");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { changeOwnPassword, resetUserPassword, verifyPassword } from "@/lib/services/auth";
import { rootReset } from "@/lib/stores";
import { useAuditStore } from "@/lib/stores/audit";
import { DomainError } from "@/lib/stores/core";
import { useCredentialStore } from "@/lib/stores/credentials";
import { useSessionStore } from "@/lib/stores/session";

const DEMO = "Demo@1234";

beforeEach(async () => {
  await rootReset();
  useSessionStore.getState().login("S07", "nurse", "BR-01");
});

async function expectFieldError(p: Promise<unknown>, field: string, message: RegExp) {
  try {
    await p;
    throw new Error("expected a DomainError");
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).fieldErrors[field]).toMatch(message);
  }
}

describe("profile password change", () => {
  it("everyone starts on the demo password", async () => {
    expect(await verifyPassword("S07", DEMO)).toBe(true);
    expect(await verifyPassword("S07", "wrong")).toBe(false);
  });

  it("enforces strength and confirmation, and rejects reusing the current password", async () => {
    await expectFieldError(changeOwnPassword({ next: "short", confirm: "short" }), "next", /8 characters/);
    await expectFieldError(changeOwnPassword({ next: "nouppercase1!", confirm: "nouppercase1!" }), "next", /uppercase/);
    await expectFieldError(changeOwnPassword({ next: "Nurse#2026", confirm: "Nurse#2027" }), "confirm", /do not match/);
    await expectFieldError(changeOwnPassword({ next: DEMO, confirm: DEMO }), "next", /different/);
  });

  it("does not ask for the current password, stores only a hash and audits the change", async () => {
    await changeOwnPassword({ next: "Nurse#2026", confirm: "Nurse#2026" });
    const stored = useCredentialStore.getState().credentials.S07;
    expect(stored?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.hash).not.toContain("Nurse");
    expect(await verifyPassword("S07", "Nurse#2026")).toBe(true);
    expect(await verifyPassword("S07", DEMO)).toBe(false);
    expect(await verifyPassword("S08", DEMO)).toBe(true);
    expect(useAuditStore.getState().events.at(-1)?.summary).toBe("Changed own password");
  });

  it("admin reset and demo reset return users to the demo password", async () => {
    await changeOwnPassword({ next: "Nurse#2026", confirm: "Nurse#2026" });
    resetUserPassword("S07");
    expect(await verifyPassword("S07", DEMO)).toBe(true);
    await changeOwnPassword({ next: "Nurse#2026", confirm: "Nurse#2026" });
    await rootReset();
    expect(await verifyPassword("S07", DEMO)).toBe(true);
  });
});

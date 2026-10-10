import { beforeEach, describe, expect, it } from "vitest";
import { postProcedure, placeOrder, requestFileReopen, requestRefund, cancelOrder } from "@/lib/services/workflows";
import { accountSummary, useBillingStore } from "@/lib/stores/billing";
import { useClinicalStore } from "@/lib/stores/clinical";
import { DomainError } from "@/lib/stores/core";
import { useEmbryologyStore } from "@/lib/stores/embryology";
import { useEpisodeStore } from "@/lib/stores/episode";
import { rootReset } from "@/lib/stores/index";
import { useAuditStore } from "@/lib/stores/audit";
import { useNotificationStore } from "@/lib/stores/notifications";
import { useOrderStore } from "@/lib/stores/orders";
import { DuplicatePersonError, usePersonStore, type PersonInput } from "@/lib/stores/person";
import { PROCEDURE_LOCKED_MESSAGE, useProcedureStore } from "@/lib/stores/procedure";
import { useRequestStore } from "@/lib/stores/requests";
import { useSessionStore } from "@/lib/stores/session";
import { availableStock } from "@/lib/selectors/stock";

const SIG = "data:image/png;base64,iVBORw0KGgo=";

function loginAs(id: string, role: Parameters<ReturnType<typeof useSessionStore.getState>["login"]>[1]) {
  useSessionStore.getState().login(id, role, "BR-01");
}

function episodeOf(firstName: string) {
  const p = usePersonStore.getState().persons.find((x) => x.firstName === firstName);
  const e = useEpisodeStore.getState().episodes.find((x) => x.patientId === p?.id);
  if (!e) throw new Error(`no episode for ${firstName}`);
  return e;
}

beforeEach(async () => {
  await rootReset();
  loginAs("S18", "admin");
});

describe("store business rules", () => {
  it("every write appends an audit event", () => {
    const before = useAuditStore.getState().events.length;
    useClinicalStore.getState().addNote(episodeOf("Adaobi").id, "doctor", "Reviewed scan; continue current dose.");
    expect(useAuditStore.getState().events.length).toBe(before + 1);
    expect(useAuditStore.getState().events.at(-1)?.actorId).toBe("S18");
  });

  it("rejects duplicate people (same name + DOB + phone) unless explicitly allowed", () => {
    const existing = usePersonStore.getState().persons.find((p) => p.firstName === "Tonye");
    if (!existing) throw new Error("seed missing Tonye");
    const { id: _id, prn: _prn, createdAt: _c, ...input } = existing;
    const dupe: PersonInput = { ...input, firstName: "tonye", lastName: "COOKEY" };
    expect(() => usePersonStore.getState().register(dupe)).toThrow(DuplicatePersonError);
    const created = usePersonStore.getState().register(dupe, { allowDuplicate: true });
    expect(created.prn).toMatch(/^PRN-BR01-\d{6}$/);
  });

  it("validates people with Zod (Nigerian phone format)", () => {
    const existing = usePersonStore.getState().persons[0];
    if (!existing) throw new Error("no person");
    const { id: _id, prn: _prn, createdAt: _c, ...input } = existing;
    try {
      usePersonStore.getState().register({ ...input, firstName: "Unique", phone: "0612345678" });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).fieldErrors.phone).toMatch(/Nigerian/);
    }
  });

  it("locks posted procedures; corrections only via addendum", () => {
    const posted = useProcedureStore.getState().procedures.find((p) => p.status === "posted");
    if (!posted) throw new Error("no posted procedure");
    const { id, status: _s, signatureDataUrl: _sig, signedAt: _at, addenda: _a, ...draft } = posted;
    expect(() => useProcedureStore.getState().saveDraft({ ...draft, postOpNote: "Changed" }, id)).toThrow(
      PROCEDURE_LOCKED_MESSAGE,
    );
    const updated = useProcedureStore.getState().addAddendum(id, "Correction: EBL 50 mL.");
    expect(updated.addenda.at(-1)?.body).toBe("Correction: EBL 50 mL.");
  });

  it("requires a signature to post a procedure, then locks it", () => {
    const ep = episodeOf("Adaobi");
    const cycle = useProcedureStore.getState().procedures.find(() => true);
    if (!cycle) throw new Error("no procedure");
    const draft = useProcedureStore.getState().saveDraft({
      cycleId: cycle.cycleId,
      type: "PRP",
      date: "2026-10-08",
      time: "10:00",
      surgeonId: "S02",
      count: 1,
      postOpNote: "PRP instilled.",
    });
    expect(() => useProcedureStore.getState().post(draft.id, "")).toThrow(/Sign/);
    const posted = postProcedure(draft.id, SIG);
    expect(posted.status).toBe("posted");
    expect(ep.id).toBeTruthy();
  });

  it("will not close an episode without an outcome and reason", () => {
    const ep = episodeOf("Efe");
    expect(() => useEpisodeStore.getState().close(ep.id, { closeReason: "not-pregnant", closeNote: "" })).toThrow(
      DomainError,
    );
    const closed = useEpisodeStore
      .getState()
      .close(ep.id, { closeReason: "not-pregnant", closeNote: "Negative beta-hCG; couple to rest." });
    expect(closed.status).toBe("closed");
  });

  it("cannot reopen a closed file without manager approval", () => {
    const ep = episodeOf("Rukayat");
    expect(() => useEpisodeStore.getState().reopen(ep.id)).toThrow(/approval/);
    loginAs("S01", "doctor");
    requestFileReopen(ep.id, "Couple returning for sibling FET.");
    const req = useRequestStore.getState().requests.find((r) => r.kind === "file-reopen" && r.entityId === ep.id);
    if (!req) throw new Error("no request");
    loginAs("S15", "manager");
    useRequestStore.getState().decide(req.id, true);
    expect(useEpisodeStore.getState().reopen(ep.id).status).toBe("open");
  });

  it("rejects zero/negative payments and allocates positive ones", () => {
    const ep = episodeOf("Adaobi");
    expect(() => useBillingStore.getState().recordPayment(ep.id, { amount: -500, method: "cash" })).toThrow(
      DomainError,
    );
    expect(() => useBillingStore.getState().recordPayment(ep.id, { amount: 0, method: "cash" })).toThrow(DomainError);
    const before = accountSummary(
      ep.id,
      useBillingStore.getState().charges,
      useBillingStore.getState().payments,
      useBillingStore.getState().refunds,
    );
    const pay = useBillingStore.getState().recordPayment(ep.id, { amount: 10_000, method: "cash" });
    const after = accountSummary(
      ep.id,
      useBillingStore.getState().charges,
      useBillingStore.getState().payments,
      useBillingStore.getState().refunds,
    );
    expect(after.balance).toBe(before.balance - 10_000);
    expect(pay.receiptNo).toMatch(/^RCP-\d{6}$/);
  });

  it("creates a charge for every order and waives it on cancellation", () => {
    const ep = episodeOf("Adaobi");
    const order = placeOrder(ep.id, { catalogCode: "LAB-AMH", qty: 1 });
    expect(useBillingStore.getState().charges.find((c) => c.orderId === order.id)?.amount).toBe(25_000);
    cancelOrder(order.id, "Duplicate request");
    expect(useBillingStore.getState().charges.find((c) => c.orderId === order.id)?.status).toBe("waived");
  });

  it("never dispenses beyond available stock and reduces stock when dispensing", () => {
    const ep = episodeOf("Adaobi");
    const stock = availableStock(useOrderStore.getState().batches, "DRG-CAB");
    const tooMany = placeOrder(ep.id, {
      catalogCode: "DRG-CAB",
      qty: stock + 1,
      dosage: "0.5 mg",
      frequency: "daily",
      duration: "8 days",
    });
    expect(() => useOrderStore.getState().dispense(tooMany.id)).toThrow(/Not enough stock/);
    const ok = placeOrder(ep.id, {
      catalogCode: "DRG-FA",
      qty: 2,
      dosage: "5 mg",
      frequency: "daily",
      duration: "30 days",
    });
    const before = availableStock(useOrderStore.getState().batches, "DRG-FA");
    useOrderStore.getState().dispense(ok.id);
    expect(availableStock(useOrderStore.getState().batches, "DRG-FA")).toBe(before - 2);
  });

  it("requires a different embryologist with the correct PIN to witness", () => {
    loginAs("S04", "embryologist");
    const embryo = useEmbryologyStore.getState().embryos.find((e) => e.status === "culturing" && e.day >= 5);
    if (!embryo) throw new Error("no culturing blastocyst");
    const slot = { tank: "T4", canister: 6, goblet: "Yellow", straw: 10 };
    expect(() => useEmbryologyStore.getState().freeze(embryo.id, slot, { witnessId: "S04", pin: "4321" })).toThrow(
      /different person/,
    );
    expect(() => useEmbryologyStore.getState().freeze(embryo.id, slot, { witnessId: "S05", pin: "0000" })).toThrow(
      /PIN/,
    );
    const pos = useEmbryologyStore.getState().freeze(embryo.id, slot, { witnessId: "S05", pin: "4321" });
    expect(useEmbryologyStore.getState().embryos.find((e) => e.id === embryo.id)?.status).toBe("cryopreserved");
    expect(pos.consentExpiry > pos.storedAt).toBe(true);
  });

  it("approvals: no self-approval, rejection needs a reason, decisions notify the requester", () => {
    loginAs("S07", "nurse");
    const req = useRequestStore.getState().create({
      kind: "leave",
      title: "Annual leave",
      details: "Family visit",
      startDate: "2026-11-02",
      endDate: "2026-11-06",
    });
    expect(() => useRequestStore.getState().decide(req.id, true)).toThrow(/own request/);
    loginAs("S15", "manager");
    expect(() => useRequestStore.getState().decide(req.id, false)).toThrow(/reason/);
    useRequestStore.getState().decide(req.id, true, "Enjoy");
    const n = useNotificationStore
      .getState()
      .notifications.filter((x) => x.userId === "S07")
      .at(-1);
    expect(n?.title).toBe("Request approved");
  });

  it("refunds go through approval and then increase the balance", () => {
    const ep = episodeOf("Adaobi");
    loginAs("S13", "accountant");
    const s = () =>
      accountSummary(
        ep.id,
        useBillingStore.getState().charges,
        useBillingStore.getState().payments,
        useBillingStore.getState().refunds,
      );
    const before = s().balance;
    requestRefund(ep.id, { amount: 5_000, reason: "Overpayment on consultation" });
    expect(s().balance).toBe(before);
    const req = useRequestStore.getState().requests.find((r) => r.kind === "refund" && r.entityId === ep.id);
    if (!req) throw new Error("no refund request");
    loginAs("S15", "manager");
    useRequestStore.getState().decide(req.id, true);
    expect(s().balance).toBe(before + 5_000);
  });

  it("reset restores the exact seed", async () => {
    const n = useOrderStore.getState().orders.length;
    placeOrder(episodeOf("Adaobi").id, { catalogCode: "LAB-FSH", qty: 1 });
    expect(useOrderStore.getState().orders.length).toBe(n + 1);
    await rootReset();
    expect(useOrderStore.getState().orders.length).toBe(n);
  });
});

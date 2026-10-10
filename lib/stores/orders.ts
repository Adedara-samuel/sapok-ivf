import { z } from "zod";
import { catalogItem } from "@/lib/constants/catalog";
import { isoDate } from "@/lib/schemas/common";
import {
  drugBatchSchema,
  orderSchema,
  stockMovementSchema,
  type DrugBatch,
  type Order,
  type StockMovement,
} from "@/lib/schemas/orders";
import type { SeedData } from "@/lib/seed/types";
import { audit } from "@/lib/stores/audit";
import { assert, createDomainStore, DomainError, validate } from "@/lib/stores/core";
import { currentActorId } from "@/lib/stores/session";
import { nowIso, todayIso } from "@/lib/utils/dates";
import { newId } from "@/lib/utils/ids";

export const placeOrderSchema = z.object({
  catalogCode: z.string().min(1, "Choose an item from the catalogue"),
  qty: z
    .number({ error: "Enter a quantity" })
    .int("Whole numbers only")
    .positive("Quantity must be at least 1")
    .max(200, "Quantity is too large"),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const resultSchema = z.object({
  resultText: z.string().min(1, "Enter the result"),
  abnormal: z.boolean(),
  critical: z.boolean(),
  resultAttachment: z.string().optional(),
});
export type ResultInput = z.infer<typeof resultSchema>;

export const receiveStockSchema = z.object({
  code: z.string().min(1, "Choose a drug"),
  batchNo: z.string().min(3, "Enter the batch number"),
  qty: z.number({ error: "Enter a quantity" }).int().positive("Quantity must be at least 1"),
  expiry: isoDate,
});
export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;

export const adjustStockSchema = z.object({
  batchId: z.string().min(1, "Choose a batch"),
  delta: z
    .number({ error: "Enter the change" })
    .int()
    .refine((n) => n !== 0, "Change cannot be zero"),
  reason: z.string().min(3, "Give a reason for the adjustment"),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export interface OrderState {
  orders: Order[];
  batches: DrugBatch[];
  movements: StockMovement[];
  place: (episodeId: string, input: PlaceOrderInput) => Order;
  setInProgress: (id: string) => void;
  enterResult: (id: string, input: ResultInput) => Order;
  cancel: (id: string, reason: string) => Order;
  dispense: (id: string) => Order;
  receiveStock: (input: ReceiveStockInput) => DrugBatch;
  adjustStock: (input: AdjustStockInput) => void;
  reset: (seed: SeedData) => void;
}

export const useOrderStore = createDomainStore<OrderState>("orders", (set, get) => {
  const find = (id: string): Order => {
    const o = get().orders.find((x) => x.id === id);
    if (!o) throw new DomainError("Order not found");
    return o;
  };
  const replace = (order: Order) =>
    set((s) => {
      s.orders[s.orders.findIndex((o) => o.id === order.id)] = order;
    });
  return {
    orders: [],
    batches: [],
    movements: [],
    place: (episodeId, input) => {
      const parsed = validate(placeOrderSchema, input);
      const item = catalogItem(parsed.catalogCode);
      if (!item) throw new DomainError("Unknown catalogue item", { catalogCode: "Unknown catalogue item" });
      const kind = item.kind === "drug" ? "pharmacy" : item.kind;
      if (kind === "pharmacy")
        assert(parsed.dosage && parsed.frequency && parsed.duration, "Enter dosage, frequency and duration", "dosage");
      const order = validate(orderSchema, {
        ...parsed,
        id: newId("ORD"),
        episodeId,
        kind,
        name: item.name,
        unitPrice: item.price,
        amount: item.price * parsed.qty,
        status: kind === "service" ? "resulted" : "ordered",
        orderedBy: currentActorId(),
        at: nowIso(),
      });
      set((s) => {
        s.orders.push(order);
      });
      audit("create", "order", `Ordered ${order.name}${order.qty > 1 ? ` × ${order.qty}` : ""}`, episodeId);
      return order;
    },
    setInProgress: (id) => {
      const o = find(id);
      assert(o.status === "ordered", "Only new orders can be started");
      replace(validate(orderSchema, { ...o, status: "in-progress" }));
      audit("update", "order", `Sample received for ${o.name}`, o.episodeId);
    },
    enterResult: (id, input) => {
      const o = find(id);
      assert(o.kind === "lab" || o.kind === "radiology", "Results apply to lab and radiology orders only");
      assert(
        o.status === "ordered" || o.status === "in-progress",
        o.status === "resulted" ? "A result has already been entered" : "This order was cancelled",
      );
      const r = validate(resultSchema, input);
      const next = validate(orderSchema, { ...o, ...r, status: "resulted", resultedAt: nowIso() });
      replace(next);
      audit(
        "post",
        "result",
        `Resulted ${o.name}${r.critical ? " (CRITICAL)" : r.abnormal ? " (abnormal)" : ""}`,
        o.episodeId,
      );
      return next;
    },
    cancel: (id, reason) => {
      const o = find(id);
      assert(o.status === "ordered" || o.status === "in-progress", "Only pending orders can be cancelled");
      assert(reason.trim().length >= 3, "Give a reason for cancelling", "cancelReason");
      const next = validate(orderSchema, { ...o, status: "cancelled", cancelReason: reason.trim() });
      replace(next);
      audit("cancel", "order", `Cancelled ${o.name}: ${reason.trim()}`, o.episodeId);
      return next;
    },
    dispense: (id) => {
      const o = find(id);
      assert(o.kind === "pharmacy", "Only pharmacy orders can be dispensed");
      assert(
        o.status === "ordered",
        o.status === "dispensed" ? "Already dispensed" : "This prescription was cancelled",
      );
      const today = todayIso();
      const usable = get()
        .batches.filter((b) => b.code === o.catalogCode && b.expiry >= today && b.qty > 0)
        .sort((a, b) => a.expiry.localeCompare(b.expiry));
      const inStock = usable.reduce((s, b) => s + b.qty, 0);
      assert(inStock >= o.qty, `Not enough stock: ${inStock} available, ${o.qty} prescribed`);
      let remaining = o.qty;
      const moves: StockMovement[] = [];
      usable.forEach((b) => {
        if (remaining <= 0) return;
        const take = Math.min(b.qty, remaining);
        remaining -= take;
        moves.push(
          validate(stockMovementSchema, {
            id: newId("MOV"),
            code: o.catalogCode,
            batchId: b.id,
            delta: -take,
            reason: `Dispensed for order ${o.id}`,
            kind: "dispense",
            orderId: o.id,
            at: nowIso(),
            by: currentActorId(),
          }),
        );
      });
      const next = validate(orderSchema, {
        ...o,
        status: "dispensed",
        dispensedAt: nowIso(),
        dispensedBy: currentActorId(),
      });
      set((s) => {
        moves.forEach((m) => {
          const b = s.batches.find((x) => x.id === m.batchId);
          if (b) b.qty += m.delta;
        });
        s.movements.push(...moves);
        s.orders[s.orders.findIndex((x) => x.id === id)] = next;
      });
      audit("dispense", "order", `Dispensed ${o.name} × ${o.qty}`, o.episodeId);
      return next;
    },
    receiveStock: (input) => {
      const r = validate(receiveStockSchema, input);
      assert(catalogItem(r.code)?.kind === "drug", "Choose a drug from the formulary", "code");
      assert(r.expiry > todayIso(), "Cannot receive stock that has already expired", "expiry");
      const batch = validate(drugBatchSchema, {
        id: newId("BAT"),
        code: r.code,
        batchNo: r.batchNo,
        qty: r.qty,
        expiry: r.expiry,
        receivedAt: todayIso(),
      });
      const move = validate(stockMovementSchema, {
        id: newId("MOV"),
        code: r.code,
        batchId: batch.id,
        delta: r.qty,
        reason: `Received batch ${r.batchNo}`,
        kind: "receive",
        at: nowIso(),
        by: currentActorId(),
      });
      set((s) => {
        s.batches.push(batch);
        s.movements.push(move);
      });
      audit(
        "create",
        "stock",
        `Received ${r.qty} × ${catalogItem(r.code)?.name ?? r.code} (batch ${r.batchNo})`,
        batch.id,
      );
      return batch;
    },
    adjustStock: (input) => {
      const a = validate(adjustStockSchema, input);
      const batch = get().batches.find((b) => b.id === a.batchId);
      if (!batch) throw new DomainError("Batch not found", { batchId: "Batch not found" });
      assert(batch.qty + a.delta >= 0, `Stock cannot go below zero (batch has ${batch.qty})`, "delta");
      const move = validate(stockMovementSchema, {
        id: newId("MOV"),
        code: batch.code,
        batchId: batch.id,
        delta: a.delta,
        reason: a.reason,
        kind: "adjust",
        at: nowIso(),
        by: currentActorId(),
      });
      set((s) => {
        const b = s.batches.find((x) => x.id === a.batchId);
        if (b) b.qty += a.delta;
        s.movements.push(move);
      });
      audit(
        "update",
        "stock",
        `Adjusted ${batch.batchNo} by ${a.delta > 0 ? "+" : ""}${a.delta}: ${a.reason}`,
        batch.id,
      );
    },
    reset: (seed) =>
      set((s) => {
        s.orders = seed.orders;
        s.batches = seed.batches;
        s.movements = seed.movements;
      }),
  };
});

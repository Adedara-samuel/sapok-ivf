import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/seed/build";
import {
  computeAlerts,
  computeTiles,
  cyclesByStage,
  ivfCollection,
  revenueVsCollections,
  type TileKey,
} from "@/lib/selectors/dashboard";
import { patientRows } from "@/lib/selectors/patients";

const seed = buildSeed(new Date("2026-10-08T10:30:00+01:00"));
const today = seed.anchor;

/** Independent re-derivation of each tile from the same lists the screens show. */
function listCount(key: TileKey, branchId: string, from?: string, to?: string): number {
  const rows = patientRows(seed.persons, seed.episodes, seed.cycles, seed.staff).filter(
    (r) => branchId === "all" || r.branchId === branchId,
  );
  const inRange = (d?: string) => (!from || (d ?? "") >= from) && (!to || (d ?? "").slice(0, 10) <= to);
  const branchEpisodes = seed.episodes.filter((e) => branchId === "all" || e.branchId === branchId);
  switch (key) {
    case "frontDesk":
      return seed.waiting.filter((w) => w.date === today && (branchId === "all" || w.branchId === branchId)).length;
    case "existingPatients":
      return rows.length;
    case "activeCycles": {
      const ids = new Set(branchEpisodes.filter((e) => e.status !== "closed").map((e) => e.id));
      return seed.cycles.filter((c) => ids.has(c.episodeId) && c.stage !== "completed" && c.stage !== "cancelled")
        .length;
    }
    case "donors":
      return seed.donors.length;
    case "surrogates":
      return seed.surrogates.length;
    case "closedFiles":
      return branchEpisodes.filter((e) => e.status === "closed" && (!from && !to ? true : inRange(e.closedAt))).length;
    case "cancelledDrugs": {
      const ids = new Set(branchEpisodes.map((e) => e.id));
      return seed.orders.filter(
        (o) =>
          ids.has(o.episodeId) &&
          o.kind === "pharmacy" &&
          o.status === "cancelled" &&
          (!from && !to ? true : inRange(o.at)),
      ).length;
    }
    case "pendingApprovals":
      return seed.requests.filter((r) => r.status === "pending").length;
  }
}

describe("dashboard tiles reconcile with their lists", () => {
  const scenarios = [
    { branchId: "all" },
    { branchId: "BR-01" },
    { branchId: "all", from: "2026-01-01", to: "2026-10-08" },
    { branchId: "BR-01", from: "2026-09-01", to: "2026-10-08" },
  ];
  it.each(scenarios)("scenario %o", (f) => {
    const tiles = computeTiles(seed, f, today);
    expect(tiles).toHaveLength(8);
    tiles.forEach((t) =>
      expect({ key: t.key, value: t.value }).toEqual({ key: t.key, value: listCount(t.key, f.branchId, f.from, f.to) }),
    );
  });

  it("matches the spec's expected seed counts", () => {
    const tiles = Object.fromEntries(computeTiles(seed, { branchId: "all" }, today).map((t) => [t.key, t.value]));
    expect(tiles.frontDesk).toBe(6);
    expect(tiles.existingPatients).toBe(40);
    expect(tiles.donors).toBe(12);
    expect(tiles.surrogates).toBe(6);
    expect(tiles.cancelledDrugs).toBe(6);
    expect(tiles.pendingApprovals).toBe(6);
  });

  it("charts are computed from store data", () => {
    const f = { branchId: "all" };
    expect(ivfCollection(seed, f).reduce((s, x) => s + x.value, 0)).toBe(seed.episodes.length);
    const activeCycles = computeTiles(seed, f, today).find((t) => t.key === "activeCycles")?.value;
    expect(cyclesByStage(seed, f).reduce((s, x) => s + x.count, 0)).toBe(activeCycles);
    const months = revenueVsCollections(seed, f, today);
    expect(months).toHaveLength(6);
    expect(months.some((m) => m.revenue > 0)).toBe(true);
  });

  it("raises alerts for cryo expiry, stock, expiring drugs, vitals and critical results", () => {
    const kinds = new Set(computeAlerts(seed, today).map((a) => a.kind));
    ["cryo", "low-stock", "expiry", "vitals", "critical"].forEach((k) => expect(kinds.has(k as never)).toBe(true));
  });
});

"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CANISTERS, GOBLETS, STRAWS_PER_GOBLET, TANKS, type StoragePosition } from "@/lib/schemas/embryology";
import type { SlotInput } from "@/lib/stores/embryology";

export function firstFreeSlot(storage: readonly StoragePosition[], preferTank: string = TANKS[0]): SlotInput {
  const taken = new Set(storage.map((p) => `${p.tank}-${p.canister}-${p.goblet}-${p.straw}`));
  const tanks = [preferTank, ...TANKS.filter((t) => t !== preferTank)];
  for (const tank of tanks)
    for (const canister of CANISTERS)
      for (const goblet of GOBLETS)
        for (let straw = 1; straw <= STRAWS_PER_GOBLET; straw += 1)
          if (!taken.has(`${tank}-${canister}-${goblet}-${straw}`)) return { tank, canister, goblet, straw };
  return { tank: TANKS[0], canister: 1, goblet: GOBLETS[0], straw: 1 };
}

/** Drag-free tank → canister → goblet → straw selector. */
export function SlotPicker({
  value,
  onChange,
  storage,
  ignoreId,
}: {
  value: SlotInput;
  onChange: (v: SlotInput) => void;
  storage: readonly StoragePosition[];
  ignoreId?: string;
}) {
  const taken = new Set(
    storage.filter((p) => p.id !== ignoreId).map((p) => `${p.tank}-${p.canister}-${p.goblet}-${p.straw}`),
  );
  const occupied = taken.has(`${value.tank}-${value.canister}-${value.goblet}-${value.straw}`);
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="slot-tank">Tank</Label>
          <Select value={value.tank} onValueChange={(v) => onChange({ ...value, tank: v })}>
            <SelectTrigger id="slot-tank" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TANKS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="slot-can">Canister</Label>
          <Select value={String(value.canister)} onValueChange={(v) => onChange({ ...value, canister: Number(v) })}>
            <SelectTrigger id="slot-can" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANISTERS.map((c) => (
                <SelectItem key={c} value={String(c)}>
                  C{c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="slot-gob">Goblet</Label>
          <Select value={value.goblet} onValueChange={(v) => onChange({ ...value, goblet: v })}>
            <SelectTrigger id="slot-gob" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOBLETS.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="slot-straw">Straw</Label>
          <Select value={String(value.straw)} onValueChange={(v) => onChange({ ...value, straw: Number(v) })}>
            <SelectTrigger id="slot-straw" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: STRAWS_PER_GOBLET }, (_, i) => i + 1).map((n) => (
                <SelectItem
                  key={n}
                  value={String(n)}
                  disabled={taken.has(`${value.tank}-${value.canister}-${value.goblet}-${n}`)}
                >
                  S{n}
                  {taken.has(`${value.tank}-${value.canister}-${value.goblet}-${n}`) ? " (occupied)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {occupied ? (
        <p className="text-destructive text-sm">This straw position is occupied — choose another.</p>
      ) : (
        <p className="text-muted-foreground text-xs">Position is free.</p>
      )}
    </div>
  );
}

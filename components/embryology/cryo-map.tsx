"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Flame, MoveRight, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SlotPicker } from "@/components/embryology/slot-picker";
import { StrawLabelPrint } from "@/components/embryology/straw-label";
import { WitnessFields } from "@/components/embryology/witness-fields";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip } from "@/components/shared/status-chip";
import { useLookups } from "@/hooks/use-lookups";
import { useRunAction } from "@/hooks/use-run-action";
import { fullName } from "@/lib/schemas/person";
import {
  CANISTERS,
  GOBLET_COLOURS,
  GOBLETS,
  STRAWS_PER_GOBLET,
  TANKS,
  positionCode,
  type StoragePosition,
} from "@/lib/schemas/embryology";
import { isDomainError } from "@/lib/stores/core";
import { useEmbryologyStore, type SlotInput, type WitnessInput } from "@/lib/stores/embryology";
import { formatDate, shiftDate, todayIso } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

const CAPACITY_PER_CANISTER = GOBLETS.length * STRAWS_PER_GOBLET;

function expiryState(p: StoragePosition, today: string): "expired" | "expiring" | "ok" {
  if (p.consentExpiry < today) return "expired";
  if (p.consentExpiry <= shiftDate(today, 45)) return "expiring";
  return "ok";
}

export function CryoMap({ canManage, initialQuery }: { canManage: boolean; initialQuery?: string }) {
  const run = useRunAction();
  const { person } = useLookups();
  const storage = useEmbryologyStore((s) => s.storage);
  const embryos = useEmbryologyStore((s) => s.embryos);
  const move = useEmbryologyStore((s) => s.move);
  const thaw = useEmbryologyStore((s) => s.thaw);
  const renew = useEmbryologyStore((s) => s.renewConsent);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [tank, setTank] = useState<string>(() =>
    initialQuery ? (storage.find((p) => positionCode(p) === initialQuery)?.tank ?? TANKS[0]) : TANKS[0],
  );
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialQuery ? (storage.find((p) => positionCode(p) === initialQuery)?.id ?? null) : null,
  );
  const [moving, setMoving] = useState(false);
  const [thawing, setThawing] = useState(false);
  const [slot, setSlot] = useState<SlotInput>({ tank: TANKS[0], canister: 1, goblet: GOBLETS[0], straw: 1 });
  const [witness, setWitness] = useState<WitnessInput>({ witnessId: "", pin: "" });
  const [error, setError] = useState<string | null>(null);
  const [renewMonths, setRenewMonths] = useState("12");
  const today = todayIso();
  const selected = storage.find((p) => p.id === selectedId);
  const owner = selected ? person(selected.ownerPersonId) : undefined;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return storage.filter((p) => {
      const o = person(p.ownerPersonId);
      return `${positionCode(p)} ${p.label} ${o ? `${fullName(o)} ${o.prn}` : ""}`.toLowerCase().includes(q);
    });
  }, [query, storage, person]);
  const matchIds = new Set(matches.map((m) => m.id));
  const byKey = new Map(storage.map((p) => [`${p.tank}-${p.canister}-${p.goblet}-${p.straw}`, p]));
  const tankCount = (t: string) => storage.filter((p) => p.tank === t).length;

  const closeDialogs = () => {
    setMoving(false);
    setThawing(false);
    setWitness({ witnessId: "", pin: "" });
    setError(null);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <SectionCard
        title="Cryo-storage map"
        description="Tank → canister → goblet → straw. Red rings mark expired consents; amber rings expire within 45 days."
        actions={
          <div className="relative w-60">
            <Search
              className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patient, PRN, position…"
              className="pl-8"
              aria-label="Search storage"
            />
          </div>
        }
      >
        <Tabs value={tank} onValueChange={setTank}>
          <TabsList>
            {TANKS.map((t) => (
              <TabsTrigger key={t} value={t}>
                {t} · {tankCount(t)}/{CANISTERS.length * CAPACITY_PER_CANISTER}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {matches.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {matches.slice(0, 12).map((m) => (
              <Button
                key={m.id}
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => {
                  setTank(m.tank);
                  setSelectedId(m.id);
                }}
              >
                {positionCode(m)}
              </Button>
            ))}
          </div>
        ) : query ? (
          <p className="text-muted-foreground mt-3 text-sm">No stored items match “{query}”.</p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CANISTERS.map((c) => {
            const count = storage.filter((p) => p.tank === tank && p.canister === c).length;
            return (
              <div key={c} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold">Canister {c}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {count}/{CAPACITY_PER_CANISTER}
                  </span>
                </div>
                <Progress
                  value={(count / CAPACITY_PER_CANISTER) * 100}
                  className="mb-3 h-1.5"
                  aria-label={`Canister ${c} fill level`}
                />
                <div className="grid gap-1.5">
                  {GOBLETS.map((g) => (
                    <div key={g} className="flex items-center gap-1.5">
                      <span className="w-12 text-[11px] font-medium" style={{ color: GOBLET_COLOURS[g] }}>
                        {g}
                      </span>
                      <div className="grid flex-1 grid-cols-10 gap-0.5">
                        {Array.from({ length: STRAWS_PER_GOBLET }, (_, i) => i + 1).map((s) => {
                          const p = byKey.get(`${tank}-${c}-${g}-${s}`);
                          const exp = p ? expiryState(p, today) : "ok";
                          const label = p ? `${positionCode(p)}: ${p.label}` : `${tank}-C${c}-${g}-S${s}: empty`;
                          return (
                            <Tooltip key={s}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={label}
                                  disabled={!p}
                                  onClick={() => p && setSelectedId(p.id)}
                                  className={cn(
                                    "h-5 rounded-sm border text-[8px] transition-transform disabled:cursor-default",
                                    p ? "hover:scale-110" : "bg-muted/40 border-dashed",
                                    p?.id === selectedId && "ring-foreground ring-2",
                                    p && matchIds.has(p.id) && "outline-primary outline-2 outline-offset-1",
                                    exp === "expired" && "ring-destructive ring-2",
                                    exp === "expiring" && "ring-warning ring-2",
                                  )}
                                  style={
                                    p
                                      ? {
                                          background: GOBLET_COLOURS[g],
                                          borderColor: GOBLET_COLOURS[g],
                                          opacity: p.itemKind === "embryo" ? 1 : 0.6,
                                        }
                                      : undefined
                                  }
                                />
                              </TooltipTrigger>
                              <TooltipContent>{label}</TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Solid straws hold embryos; lighter straws hold oocytes or sperm.
        </p>
      </SectionCard>

      <SectionCard title="Selected straw">
        {!selected ? (
          <EmptyState title="Select a straw" description="Click a filled straw or search to see details and actions." />
        ) : (
          <div className="grid gap-3 text-sm">
            <p className="text-lg font-semibold">{positionCode(selected)}</p>
            <dl className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-muted-foreground text-xs">Item</dt>
                <dd className="capitalize">{selected.itemKind}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Label</dt>
                <dd>{selected.label}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Owner</dt>
                <dd>{owner ? `${fullName(owner)} · ${owner.prn}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Stored</dt>
                <dd>{formatDate(selected.storedAt)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground text-xs">Storage consent</dt>
                <dd className="flex items-center gap-2">
                  {formatDate(selected.consentExpiry)}
                  <StatusChip
                    status={expiryState(selected, today) === "ok" ? "signed" : expiryState(selected, today)}
                    label={
                      expiryState(selected, today) === "ok"
                        ? "Valid"
                        : expiryState(selected, today) === "expired"
                          ? "Expired"
                          : "Expiring soon"
                    }
                  />
                </dd>
              </div>
            </dl>
            {selected.itemKind === "embryo" ? (
              <p className="text-muted-foreground text-xs">
                {(() => {
                  const e = embryos.find((x) => x.id === selected.itemId);
                  return e ? `${e.label} · D${e.day} · ${e.grade ?? "ungraded"} · PGT ${e.pgtResult}` : "";
                })()}
              </p>
            ) : null}
            <StrawLabelPrint pos={selected} owner={owner ? fullName(owner) : "—"} prn={owner?.prn ?? "—"} />
            {canManage ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSlot({
                        tank: selected.tank,
                        canister: selected.canister,
                        goblet: selected.goblet,
                        straw: selected.straw,
                      });
                      setMoving(true);
                    }}
                  >
                    <MoveRight aria-hidden="true" /> Move
                  </Button>
                  {selected.itemKind === "embryo" ? (
                    <Button size="sm" variant="outline" onClick={() => setThawing(true)}>
                      <Flame aria-hidden="true" /> Warm (thaw)
                    </Button>
                  ) : null}
                </div>
                <div className="flex items-end gap-2">
                  <Select value={renewMonths} onValueChange={setRenewMonths}>
                    <SelectTrigger size="sm" className="w-32" aria-label="Renewal period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["6", "12", "24"].map((m) => (
                        <SelectItem key={m} value={m}>
                          {m} months
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() =>
                      run(
                        () => {
                          renew(selected.id, Number(renewMonths));
                          return true;
                        },
                        { success: "Storage consent renewed" },
                      )
                    }
                  >
                    <CalendarPlus aria-hidden="true" /> Renew consent
                  </Button>
                </div>
              </>
            ) : null}
            <Badge variant="outline" className="w-fit">
              Chain-of-custody entries are recorded for every move
            </Badge>
          </div>
        )}
      </SectionCard>

      <Dialog open={moving} onOpenChange={(o) => (!o ? closeDialogs() : undefined)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Move {selected ? positionCode(selected) : ""}</DialogTitle>
            <DialogDescription>Choose the new position. A second embryologist must witness the move.</DialogDescription>
          </DialogHeader>
          <SlotPicker value={slot} onChange={setSlot} storage={storage} ignoreId={selected?.id} />
          <WitnessFields value={witness} onChange={setWitness} error={error} />
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selected) return;
                try {
                  move(selected.id, slot, witness);
                  toast.success(`Moved to ${positionCode(slot)}`);
                  setTank(slot.tank);
                  closeDialogs();
                } catch (e) {
                  setError(isDomainError(e) ? e.message : "Move failed");
                }
              }}
            >
              Confirm move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={thawing} onOpenChange={(o) => (!o ? closeDialogs() : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Warm embryo from {selected ? positionCode(selected) : ""}</DialogTitle>
            <DialogDescription>
              The straw position is released and the embryo appears on the lab board as warmed, ready for transfer.
            </DialogDescription>
          </DialogHeader>
          <WitnessFields value={witness} onChange={setWitness} error={error} />
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selected?.itemId) return;
                try {
                  thaw(selected.itemId, witness);
                  toast.success("Embryo warmed");
                  setSelectedId(null);
                  closeDialogs();
                } catch (e) {
                  setError(isDomainError(e) ? e.message : "Warming failed");
                }
              }}
            >
              Confirm with witness
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

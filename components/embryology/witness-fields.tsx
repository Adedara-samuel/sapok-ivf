"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WitnessInput } from "@/lib/stores/embryology";
import { currentActorId } from "@/lib/stores/session";
import { useStaffStore } from "@/lib/stores/staff";

/** Second-embryologist witness check (witness + PIN). */
export function WitnessFields({
  value,
  onChange,
  error,
}: {
  value: WitnessInput;
  onChange: (v: WitnessInput) => void;
  error?: string | null;
}) {
  const staff = useStaffStore((s) => s.staff);
  const me = currentActorId();
  const witnesses = staff.filter((s) => s.role === "embryologist" && s.active && s.id !== me);
  return (
    <fieldset className="bg-muted/40 grid gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">Two-person witness check</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="witness-id">Witnessing embryologist</Label>
          <Select value={value.witnessId} onValueChange={(v) => onChange({ ...value, witnessId: v })}>
            <SelectTrigger id="witness-id" className="w-full">
              <SelectValue placeholder="Select witness" />
            </SelectTrigger>
            <SelectContent>
              {witnesses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="witness-pin">Witness PIN</Label>
          <Input
            id="witness-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={value.pin}
            onChange={(e) => onChange({ ...value, pin: e.target.value })}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "witness-error" : "witness-hint"}
          />
        </div>
      </div>
      {error ? (
        <p id="witness-error" className="text-destructive text-sm">
          {error}
        </p>
      ) : (
        <p id="witness-hint" className="text-muted-foreground text-xs">
          Demo witness PIN: 4321. The witness must be a different embryologist.
        </p>
      )}
    </fieldset>
  );
}

"use client";

import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/shared/date-picker";

/** From/To date filter pair used by lists, reports and the dashboard. */
export function DateRangeFields({
  idPrefix,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  idPrefix: string;
  from?: string;
  to?: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  const valid = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1">
        <Label htmlFor={`${idPrefix}-from`} className="text-xs">
          From
        </Label>
        <DatePicker
          id={`${idPrefix}-from`}
          className="w-40"
          value={from || undefined}
          max={valid(to) || undefined}
          onChange={(v) => onFromChange(valid(v))}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${idPrefix}-to`} className="text-xs">
          To
        </Label>
        <DatePicker
          id={`${idPrefix}-to`}
          className="w-40"
          value={to || undefined}
          min={valid(from) || undefined}
          onChange={(v) => onToChange(valid(v))}
        />
      </div>
    </div>
  );
}

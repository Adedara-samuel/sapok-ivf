"use client";

import { forwardRef, useState } from "react";
import { format, isValid, parse, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";

const DISPLAY = "dd/MM/yyyy";

function toDisplay(iso: string | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso ?? "";
  return format(parseISO(iso), DISPLAY);
}

/** Parses DD/MM/YYYY (also D/M/YYYY) to YYYY-MM-DD; returns null when incomplete or invalid. */
export function parseDisplayDate(text: string): string | null {
  const t = text.trim();
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) return null;
  const d = parse(t, "d/M/yyyy", new Date());
  return isValid(d) ? format(d, "yyyy-MM-dd") : null;
}

export interface DatePickerProps {
  value?: string;
  onChange: (iso: string | undefined) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  min?: string;
  max?: string;
  className?: string;
  /** Year range for the month/year dropdowns (e.g. dates of birth). */
  fromYear?: number;
  toYear?: number;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
  "aria-label"?: string;
}

/**
 * shadcn date picker: type DD/MM/YYYY or pick from the calendar popover.
 * Value is an ISO date string (YYYY-MM-DD). Invalid typed text is passed through so validation can report it.
 */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(function DatePicker(
  {
    value,
    onChange,
    onBlur,
    id,
    name,
    disabled,
    placeholder = "DD/MM/YYYY",
    min,
    max,
    className,
    fromYear,
    toYear,
    ...aria
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const selected = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(value) : undefined;
  const now = new Date();
  const startYear = fromYear ?? now.getFullYear() - 5;
  const endYear = toYear ?? now.getFullYear() + 3;
  const disabledDays = [...(min ? [{ before: parseISO(min) }] : []), ...(max ? [{ after: parseISO(max) }] : [])];

  return (
    <div className={cn("relative", className)}>
      <Input
        ref={ref}
        id={id}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        value={draft ?? toDisplay(value)}
        className="pr-10 tabular-nums"
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          if (text.trim() === "") onChange(undefined);
          else onChange(parseDisplayDate(text) ?? text);
        }}
        onBlur={() => {
          setDraft(null);
          onBlur?.();
        }}
        {...aria}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="text-muted-foreground absolute top-1/2 right-1 size-7 -translate-y-1/2"
            aria-label="Open calendar"
          >
            <CalendarDays aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? (max ? parseISO(max) : undefined)}
            captionLayout="dropdown"
            startMonth={new Date(startYear, 0)}
            endMonth={new Date(endYear, 11)}
            disabled={disabledDays}
            onSelect={(d) => {
              if (!d) return;
              setDraft(null);
              onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
});

"use client";

import { forwardRef, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils/cn";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function normalise(text: string): string {
  const m = /^(\d{1,2})[:.]?(\d{2})$/.exec(text.trim());
  if (!m) return text;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return text;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export interface TimePickerProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
}

/** shadcn time picker: type HH:mm (24-hour) or choose hour and minute from the popover. */
export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(function TimePicker(
  { value, onChange, onBlur, id, name, disabled, className, ...aria },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [hour, minute] = (value ?? "").split(":");
  const set = (h: string, m: string) => onChange(`${h}:${m}`);
  return (
    <div className={cn("relative", className)}>
      <Input
        ref={ref}
        id={id}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        placeholder="HH:MM"
        disabled={disabled}
        value={value ?? ""}
        className="pr-10 tabular-nums"
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        onBlur={(e) => {
          if (e.target.value) onChange(normalise(e.target.value));
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
            aria-label="Choose time"
          >
            <Clock aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-44 p-2"
          align="end"
          onOpenAutoFocus={(e) => {
            const root = e.currentTarget as HTMLElement | null;
            requestAnimationFrame(() =>
              root
                ?.querySelectorAll<HTMLElement>('[aria-selected="true"]')
                .forEach((el) => el.scrollIntoView({ block: "center" })),
            );
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-muted-foreground mb-1 text-center text-xs font-medium">Hour</p>
              <ScrollArea className="h-56 rounded-md border">
                <div className="grid gap-0.5 p-1" role="listbox" aria-label="Hour">
                  {HOURS.map((h) => (
                    <Button
                      key={h}
                      type="button"
                      size="sm"
                      variant={hour === h ? "default" : "ghost"}
                      className="h-7 tabular-nums"
                      role="option"
                      aria-selected={hour === h}
                      onClick={() => set(h, minute && MINUTES.includes(minute) ? minute : "00")}
                    >
                      {h}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-center text-xs font-medium">Minute</p>
              <ScrollArea className="h-56 rounded-md border">
                <div className="grid gap-0.5 p-1" role="listbox" aria-label="Minute">
                  {MINUTES.map((m) => (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={minute === m ? "default" : "ghost"}
                      className="h-7 tabular-nums"
                      role="option"
                      aria-selected={minute === m}
                      onClick={() => {
                        set(hour && HOURS.includes(hour) ? hour : "09", m);
                        setOpen(false);
                      }}
                    >
                      {m}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});

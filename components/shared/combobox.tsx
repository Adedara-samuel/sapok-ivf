"use client";

import { forwardRef, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";

/** shadcn combobox over a suggestion list that also accepts a typed custom value. */
export const Combobox = forwardRef<
  HTMLButtonElement,
  {
    value?: string;
    onChange: (v: string) => void;
    options: readonly string[];
    placeholder?: string;
    id?: string;
    "aria-label"?: string;
    "aria-invalid"?: boolean;
  }
>(function Combobox({ value, onChange, options, placeholder = "Select…", id, ...aria }, ref) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const custom =
    query.trim() && !options.some((o) => o.toLowerCase() === query.trim().toLowerCase()) ? query.trim() : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          {...aria}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || placeholder}</span>
          <ChevronsUpDown className="opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search or type…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No suggestions.</CommandEmpty>
            <CommandGroup>
              {custom ? (
                <CommandItem
                  value={`__custom ${custom}`}
                  onSelect={() => {
                    onChange(custom);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Plus aria-hidden="true" /> Use “{custom}”
                </CommandItem>
              ) : null}
              {options.map((o) => (
                <CommandItem
                  key={o}
                  value={o}
                  onSelect={() => {
                    onChange(o);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn(value === o ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                  {o}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

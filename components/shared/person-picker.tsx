"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Person, PersonRole } from "@/lib/schemas/person";
import { fullName } from "@/lib/schemas/person";
import { usePersonStore } from "@/lib/stores/person";
import { cn } from "@/lib/utils/cn";

/** Searchable person combobox (name, PRN or phone). */
export function PersonPicker({
  value,
  onChange,
  roles = ["patient"],
  branchId,
  placeholder = "Search by name, PRN or phone…",
  id,
  invalid,
  filter,
}: {
  value?: string;
  onChange: (person: Person) => void;
  roles?: PersonRole[];
  branchId?: string;
  placeholder?: string;
  id?: string;
  invalid?: boolean;
  filter?: (p: Person) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const persons = usePersonStore((s) => s.persons);
  const options = useMemo(
    () =>
      persons.filter(
        (p) =>
          p.roles.some((r) => roles.includes(r)) && (!branchId || p.branchId === branchId) && (!filter || filter(p)),
      ),
    [persons, roles, branchId, filter],
  );
  const selected = persons.find((p) => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? `${fullName(selected)} · ${selected.prn}` : placeholder}
          </span>
          <ChevronsUpDown className="opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No matching person. Register them first.</CommandEmpty>
            <CommandGroup>
              {options.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.firstName} ${p.lastName} ${p.prn} ${p.phone}`}
                  onSelect={() => {
                    onChange(p);
                    setOpen(false);
                  }}
                >
                  <Check className={cn(value === p.id ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                  <span className="flex flex-col">
                    <span>{fullName(p)}</span>
                    <span className="text-muted-foreground text-xs">
                      {p.prn} · {p.phone}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

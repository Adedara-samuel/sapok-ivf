"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPlus, Clock, CreditCard, FileBarChart, UserPlus, Users } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { NAV } from "@/components/layout/nav";
import { useCan } from "@/hooks/use-permission";
import { EPISODE_TYPE_LABELS } from "@/lib/constants/clinical";
import { useEpisodeStore } from "@/lib/stores/episode";
import { usePersonStore } from "@/lib/stores/person";
import { useSessionStore } from "@/lib/stores/session";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const can = useCan();
  const persons = usePersonStore((s) => s.persons);
  const episodes = useEpisodeStore((s) => s.episodes);
  const branchId = useSessionStore((s) => s.branchId);

  const patients = useMemo(
    () =>
      persons
        .filter((p) => p.roles.includes("patient") || p.roles.includes("partner"))
        .map((p) => {
          const ep = episodes.find((e) => e.patientId === p.id || e.partnerId === p.id);
          const fileId = ep ? ep.patientId : p.id;
          return { p, ep, fileId, other: p.branchId !== branchId };
        }),
    [persons, episodes, branchId],
  );

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const actions = [
    {
      label: "New registration",
      href: "/patients/new",
      icon: UserPlus,
      cap: "patients.create" as const,
      shortcut: "N",
    },
    { label: "Add patient to waiting list", href: "/waiting-list?add=1", icon: Clock, cap: "waiting.manage" as const },
    { label: "Record a payment", href: "/billing", icon: CreditCard, cap: "billing.collect" as const },
    { label: "New staff request", href: "/requests?new=1", icon: ClipboardPlus, cap: "requests.create" as const },
    { label: "Success-rate analytics", href: "/reports?tab=success", icon: FileBarChart, cap: "reports.view" as const },
  ].filter((a) => can(a.cap));

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search and quick actions"
      description="Search patients by name, PRN, IVF number or phone, or jump to a screen."
    >
      <CommandInput placeholder="Search patients, PRN, IVF no, phone, or type a command…" />
      <CommandList>
        <CommandEmpty>No matches. Try a PRN like PRN-BR01-000101 or a phone number.</CommandEmpty>
        {can("patients.view") ? (
          <CommandGroup heading="Patients">
            {patients.map(({ p, ep, fileId, other }) => (
              <CommandItem
                key={p.id}
                value={`${p.firstName} ${p.lastName} ${p.prn} ${ep?.ivfNo ?? ""} ${p.phone}`}
                onSelect={() => go(`/patients/${fileId}`)}
              >
                <Users aria-hidden="true" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">
                    {p.firstName} {p.lastName}
                    {p.roles.includes("partner") ? <span className="text-muted-foreground"> (partner)</span> : null}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {p.prn} · {ep ? `${ep.ivfNo} · ${EPISODE_TYPE_LABELS[ep.type]}` : "No episode"} · {p.phone}
                    {other ? " · other branch" : ""}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          {actions.map((a) => (
            <CommandItem key={a.label} onSelect={() => go(a.href)}>
              <a.icon aria-hidden="true" />
              {a.label}
              {a.shortcut ? <CommandShortcut>{a.shortcut}</CommandShortcut> : null}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {NAV.flatMap((g) => g.items)
            .filter((i) => can(i.capability))
            .map((i) => (
              <CommandItem key={i.href} onSelect={() => go(i.href)}>
                <i.icon aria-hidden="true" />
                {i.label}
              </CommandItem>
            ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

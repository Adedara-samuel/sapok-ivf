"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FolderPlus, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { OpenEpisodeDialog } from "@/components/patient/open-episode-dialog";
import { PatientHeader } from "@/components/patient/patient-header";
import { PatientSummaryPrint } from "@/components/patient/patient-summary-print";
import { BillingTab } from "@/components/patient/tabs/billing-tab";
import { CloseTab } from "@/components/patient/tabs/close-tab";
import { ConsentsTab } from "@/components/patient/tabs/consents-tab";
import { CyclesTab } from "@/components/patient/tabs/cycles-tab";
import { DocumentsTab } from "@/components/patient/tabs/documents-tab";
import { HistoryTab } from "@/components/patient/tabs/history-tab";
import { InvestigationsTab } from "@/components/patient/tabs/investigations-tab";
import { NotesTab } from "@/components/patient/tabs/notes-tab";
import { PharmacyTab } from "@/components/patient/tabs/pharmacy-tab";
import { ProceduresTab } from "@/components/patient/tabs/procedures-tab";
import { TimelineTab } from "@/components/patient/tabs/timeline-tab";
import { VitalsTab } from "@/components/patient/tabs/vitals-tab";
import type { PatientCtx } from "@/components/patient/types";
import { useCan } from "@/hooks/use-permission";
import type { Capability } from "@/lib/permissions";
import { fullName } from "@/lib/schemas/person";
import { primaryEpisodeFor } from "@/lib/selectors/predicates";
import { logSensitiveView } from "@/lib/services/workflows";
import { useEpisodeStore } from "@/lib/stores/episode";
import { usePersonStore } from "@/lib/stores/person";

const TABS: {
  value: string;
  label: string;
  capability?: Capability;
  Component: (p: { ctx: PatientCtx }) => React.ReactNode;
}[] = [
  { value: "timeline", label: "Timeline", Component: TimelineTab },
  { value: "notes", label: "Notes", capability: "clinical.view", Component: NotesTab },
  { value: "cycles", label: "Cycles", capability: "clinical.view", Component: CyclesTab },
  { value: "pharmacy", label: "Prescriptions", capability: "clinical.view", Component: PharmacyTab },
  { value: "investigations", label: "Investigations", capability: "clinical.view", Component: InvestigationsTab },
  { value: "procedures", label: "Procedures", capability: "clinical.view", Component: ProceduresTab },
  { value: "vitals", label: "Vitals", capability: "clinical.view", Component: VitalsTab },
  { value: "history", label: "Medical history", capability: "clinical.view", Component: HistoryTab },
  { value: "consents", label: "Consents", capability: "clinical.view", Component: ConsentsTab },
  { value: "billing", label: "Billing", capability: "billing.view", Component: BillingTab },
  { value: "documents", label: "Documents", Component: DocumentsTab },
  { value: "close", label: "Close file", capability: "clinical.view", Component: CloseTab },
];

export function PatientFile({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const can = useCan();
  const persons = usePersonStore((s) => s.persons);
  const allEpisodes = useEpisodeStore((s) => s.episodes);
  const [openEpisode, setOpenEpisode] = useState(false);
  const logged = useRef<string | null>(null);

  const person = persons.find((p) => p.id === id);
  // Partners resolve to the couple's file
  const partnerOf =
    person && !person.roles.includes("patient") ? allEpisodes.find((e) => e.partnerId === person.id) : undefined;
  useEffect(() => {
    if (partnerOf) router.replace(`/patients/${partnerOf.patientId}`);
  }, [partnerOf, router]);

  const ctx = useMemo<PatientCtx | null>(() => {
    if (!person) return null;
    const episodes = allEpisodes
      .filter((e) => e.patientId === person.id)
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    const chosen = episodes.find((e) => e.id === params.get("episode")) ?? primaryEpisodeFor(person.id, allEpisodes);
    const partner = chosen?.partnerId ? persons.find((p) => p.id === chosen.partnerId) : undefined;
    return { patient: person, partner, episode: chosen, episodes };
  }, [person, allEpisodes, persons, params]);

  useEffect(() => {
    if (person && logged.current !== person.id) {
      logged.current = person.id;
      logSensitiveView("patient", `Opened patient file ${person.prn} (${fullName(person)})`, person.id);
    }
  }, [person]);

  if (!person || !ctx) {
    return (
      <EmptyState
        icon={UserX}
        title="Patient not found"
        description="The record may have been removed by a data reset."
        action={
          <Button asChild>
            <Link href="/patients">Back to patients</Link>
          </Button>
        }
      />
    );
  }
  if (partnerOf) return null;

  const tabs = TABS.filter((t) => !t.capability || can(t.capability));
  const current = tabs.find((t) => t.value === params.get("tab"))?.value ?? "timeline";
  const setTab = (value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title="Patient file"
        crumbs={[{ label: "Patients", href: "/patients" }, { label: `${fullName(person)} · ${person.prn}` }]}
        actions={
          <>
            <PatientSummaryPrint ctx={ctx} />
            {!ctx.episodes.some((e) => e.status !== "closed") && can("patients.edit") ? (
              <Button onClick={() => setOpenEpisode(true)}>
                <FolderPlus aria-hidden="true" /> Open episode
              </Button>
            ) : null}
          </>
        }
      />
      <PatientHeader
        ctx={ctx}
        onEpisodeChange={(eid) => {
          const next = new URLSearchParams(params.toString());
          next.set("episode", eid);
          router.replace(`${pathname}?${next.toString()}`, { scroll: false });
        }}
      />
      {!ctx.episode ? (
        <EmptyState
          icon={FolderPlus}
          title="No treatment episode yet"
          description="This patient is registered but has no IVF episode. Open one to start notes, cycles and orders."
          action={can("patients.edit") ? <Button onClick={() => setOpenEpisode(true)}>Open episode</Button> : undefined}
          className="mb-4"
        />
      ) : null}
      <Tabs value={current} onValueChange={setTab}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="w-max">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4">
            {current === t.value ? <t.Component ctx={ctx} /> : null}
          </TabsContent>
        ))}
      </Tabs>
      <OpenEpisodeDialog
        patient={person}
        defaultPartnerId={
          persons.find(
            (p) => p.roles.includes("partner") && p.lastName === person.lastName && p.nextOfKin.phone === person.phone,
          )?.id
        }
        open={openEpisode}
        onOpenChange={setOpenEpisode}
      />
    </>
  );
}

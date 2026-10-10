"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useEpisodeStore } from "@/lib/stores/episode";
import { usePersonStore } from "@/lib/stores/person";
import { useUiStore } from "@/lib/stores/ui";

interface Step {
  title: string;
  body: string;
  href: string;
}

export function DemoTour() {
  const router = useRouter();
  const pathname = usePathname();
  const active = useUiStore((s) => s.tourActive);
  const step = useUiStore((s) => s.tourStep);
  const setStep = useUiStore((s) => s.setTourStep);
  const endTour = useUiStore((s) => s.endTour);
  const persons = usePersonStore((s) => s.persons);
  const episodes = useEpisodeStore((s) => s.episodes);

  const steps = useMemo<Step[]>(() => {
    const adaobi = persons.find((p) => p.firstName === "Adaobi" && p.lastName === "Okafor");
    const ep = episodes.find((e) => e.patientId === adaobi?.id);
    const patientHref = adaobi ? `/patients/${adaobi.id}` : "/patients";
    return [
      {
        title: "Executive dashboard",
        body: "Tiles, charts and alerts are computed live from the stores. Click any tile to open the list behind the number.",
        href: "/dashboard",
      },
      {
        title: "Today's waiting list",
        body: "Front desk adds arrivals, calls patients and starts consultations. The wait-time counter runs live.",
        href: "/waiting-list",
      },
      {
        title: "Existing patients",
        body: "Filter by stage, doctor, payer or status, choose columns and export to CSV or PDF.",
        href: "/patients",
      },
      {
        title: "Patient file",
        body: "Adaobi Okafor is on day 8 of stimulation. Twelve tabs cover notes, cycles, orders, procedures, consents and billing.",
        href: patientHref,
      },
      {
        title: "Cycle workspace",
        body: "Follicle growth chart, hormone trend, trigger planning, OCR summary, embryo selection and outcome.",
        href: ep ? `${patientHref}?tab=cycles` : patientHref,
      },
      {
        title: "Embryology lab",
        body: "Daily D0–D6 board, grading, witnessed freeze/thaw and the tank → canister → goblet → straw cryo map.",
        href: "/embryology",
      },
      {
        title: "Pharmacy",
        body: "Dispense queue with FEFO stock deduction, batch expiry and low-stock alerts.",
        href: "/pharmacy",
      },
      {
        title: "Billing",
        body: "Account balances, aging buckets, part-payments, refunds through approval and HMO claims.",
        href: "/billing",
      },
      {
        title: "Reports & analytics",
        body: "Fertilisation, blastocyst, clinical pregnancy and live-birth rates by age band, protocol, doctor and embryologist.",
        href: "/reports?tab=success",
      },
      {
        title: "Admin & audit",
        body: "Edit the live permission matrix, configure forms and templates, review the audit trail, and reset the demo.",
        href: "/admin",
      },
    ];
  }, [persons, episodes]);

  const current = steps[step];
  if (!active || !current) return null;

  const goTo = (i: number) => {
    const target = steps[i];
    if (!target) return;
    setStep(i);
    router.push(target.href);
  };

  return (
    <AnimatePresence>
      <motion.aside
        key={step}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-card no-print fixed right-4 bottom-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border p-4 shadow-xl"
        role="dialog"
        aria-label="Guided demo"
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-primary flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="size-3.5" aria-hidden="true" /> Guided demo · {step + 1}/{steps.length}
          </p>
          <Button variant="ghost" size="icon" className="size-7" onClick={endTour} aria-label="End guided demo">
            <X />
          </Button>
        </div>
        <Progress value={((step + 1) / steps.length) * 100} className="mb-3 h-1" />
        <p className="font-semibold">{current.title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{current.body}</p>
        {pathname !== current.href.split("?")[0] ? (
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => router.push(current.href)}>
            Open this screen
          </Button>
        ) : null}
        <div className="mt-3 flex justify-between">
          <Button variant="outline" size="sm" onClick={() => goTo(step - 1)} disabled={step === 0}>
            <ArrowLeft aria-hidden="true" /> Back
          </Button>
          {step < steps.length - 1 ? (
            <Button size="sm" onClick={() => goTo(step + 1)}>
              Next <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Button size="sm" onClick={endTour}>
              Finish
            </Button>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

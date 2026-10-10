"use client";

import { useMemo } from "react";
import type { ClinicDb } from "@/lib/selectors/types";
import { useBillingStore } from "@/lib/stores/billing";
import { useClinicalStore } from "@/lib/stores/clinical";
import { useCycleStore } from "@/lib/stores/cycle";
import { useEmbryologyStore } from "@/lib/stores/embryology";
import { useEpisodeStore } from "@/lib/stores/episode";
import { useOrderStore } from "@/lib/stores/orders";
import { usePersonStore } from "@/lib/stores/person";
import { useProcedureStore } from "@/lib/stores/procedure";
import { useProgrammeStore } from "@/lib/stores/programme";
import { useRequestStore } from "@/lib/stores/requests";
import { useStaffStore } from "@/lib/stores/staff";
import { useWaitingStore } from "@/lib/stores/waiting";

/** Read model over all stores, built from fine-grained selectors so it only changes when data does. */
export function useClinicDb(): ClinicDb {
  const persons = usePersonStore((s) => s.persons);
  const episodes = useEpisodeStore((s) => s.episodes);
  const cycles = useCycleStore((s) => s.cycles);
  const orders = useOrderStore((s) => s.orders);
  const batches = useOrderStore((s) => s.batches);
  const charges = useBillingStore((s) => s.charges);
  const payments = useBillingStore((s) => s.payments);
  const refunds = useBillingStore((s) => s.refunds);
  const donors = useProgrammeStore((s) => s.donors);
  const surrogates = useProgrammeStore((s) => s.surrogates);
  const requests = useRequestStore((s) => s.requests);
  const waiting = useWaitingStore((s) => s.entries);
  const storage = useEmbryologyStore((s) => s.storage);
  const embryos = useEmbryologyStore((s) => s.embryos);
  const vitals = useClinicalStore((s) => s.vitals);
  const procedures = useProcedureStore((s) => s.procedures);
  const staff = useStaffStore((s) => s.staff);
  return useMemo(
    () => ({
      persons,
      episodes,
      cycles,
      orders,
      batches,
      charges,
      payments,
      refunds,
      donors,
      surrogates,
      requests,
      waiting,
      storage,
      embryos,
      vitals,
      procedures,
      staff,
    }),
    [
      persons,
      episodes,
      cycles,
      orders,
      batches,
      charges,
      payments,
      refunds,
      donors,
      surrogates,
      requests,
      waiting,
      storage,
      embryos,
      vitals,
      procedures,
      staff,
    ],
  );
}

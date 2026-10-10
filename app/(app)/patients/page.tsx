import { Suspense } from "react";
import type { Metadata } from "next";
import { PatientsListView } from "@/components/patients/patients-list-view";

export const metadata: Metadata = { title: "Existing patients" };

export default function PatientsPage() {
  return (
    <Suspense>
      <PatientsListView />
    </Suspense>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { PatientFile } from "@/components/patient/patient-file";

export const metadata: Metadata = { title: "Patient file" };

export default async function PatientFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <PatientFile id={id} />
    </Suspense>
  );
}

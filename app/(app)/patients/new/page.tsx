import { Suspense } from "react";
import type { Metadata } from "next";
import { RegistrationWizard } from "@/components/patients/registration-wizard";

export const metadata: Metadata = { title: "New registration" };

export default function NewPatientPage() {
  return (
    <Suspense>
      <RegistrationWizard />
    </Suspense>
  );
}

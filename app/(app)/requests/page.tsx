import { Suspense } from "react";
import type { Metadata } from "next";
import { RequestsView } from "@/components/requests/requests-view";

export const metadata: Metadata = { title: "Requests" };

export default function RequestsPage() {
  return (
    <Suspense>
      <RequestsView />
    </Suspense>
  );
}

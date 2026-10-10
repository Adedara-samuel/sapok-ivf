import { Suspense } from "react";
import type { Metadata } from "next";
import { WaitingListView } from "@/components/waiting/waiting-list-view";

export const metadata: Metadata = { title: "Waiting list" };

export default function WaitingListPage() {
  return (
    <Suspense>
      <WaitingListView />
    </Suspense>
  );
}

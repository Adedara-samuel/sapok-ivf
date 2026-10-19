import { Suspense } from "react";
import type { Metadata } from "next";
import { SubscriptionView } from "@/components/subscription/subscription-view";

export const metadata: Metadata = { title: "Subscription & support" };

export default function SubscriptionPage() {
  return (
    <Suspense>
      <SubscriptionView />
    </Suspense>
  );
}

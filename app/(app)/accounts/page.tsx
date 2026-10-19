import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountsListView } from "@/components/accounts/accounts-list-view";

export const metadata: Metadata = { title: "Family & patient accounts" };

export default function AccountsPage() {
  return (
    <Suspense>
      <AccountsListView />
    </Suspense>
  );
}

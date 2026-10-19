import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountDetailView } from "@/components/accounts/account-detail-view";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <AccountDetailView id={id} />
    </Suspense>
  );
}

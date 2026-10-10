import { Suspense } from "react";
import type { Metadata } from "next";
import { ForbiddenView } from "@/components/layout/forbidden-view";

export const metadata: Metadata = { title: "Access restricted" };

export default function ForbiddenPage() {
  return (
    <Suspense>
      <ForbiddenView />
    </Suspense>
  );
}

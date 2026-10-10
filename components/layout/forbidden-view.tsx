"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/permissions";
import { useSessionStore } from "@/lib/stores/session";

export function ForbiddenView() {
  const from = useSearchParams().get("from") ?? "that page";
  const role = useSessionStore((s) => s.role);
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <span className="text-warning bg-warning/10 flex size-16 items-center justify-center rounded-full">
        <ShieldAlert className="size-8" aria-hidden="true" />
      </span>
      <p className="text-muted-foreground text-sm font-semibold tracking-widest">403 · ACCESS RESTRICTED</p>
      <h1 className="text-2xl font-semibold">You don&apos;t have access to {from}</h1>
      <p className="text-muted-foreground max-w-lg text-sm">
        Your role ({role ? ROLE_LABELS[role] : "unknown"}) isn&apos;t permitted to open this area. The attempt has been
        recorded in the audit log. If you need access, ask an administrator to update the permission matrix.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}

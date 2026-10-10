"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResetDemoButton } from "@/components/layout/footer";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center" role="alert">
      <span className="bg-destructive/10 text-destructive flex size-14 items-center justify-center rounded-full">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </span>
      <h1 className="text-xl font-semibold">This screen couldn&apos;t load</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        Something unexpected happened. Try again, go back to the dashboard, or reset the demo data if the problem
        continues.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw aria-hidden="true" /> Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <ResetDemoButton size="default" />
      </div>
    </div>
  );
}

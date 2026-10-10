"use client";

import { useRef, useState, type ReactNode } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { audit } from "@/lib/stores/audit";

/** Preview + print any printable sheet. `render` receives the ref to attach to the printable root. */
export function PrintDialog({
  trigger,
  title,
  documentTitle,
  auditEntity,
  auditId,
  children,
}: {
  trigger?: ReactNode;
  title: string;
  documentTitle: string;
  auditEntity: string;
  auditId?: string;
  children: (ref: React.Ref<HTMLDivElement>) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const print = useReactToPrint({
    contentRef: ref,
    documentTitle,
    onAfterPrint: () => audit("print", auditEntity, `Printed ${title}`, auditId),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Printer aria-hidden="true" /> Print
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Preview below. Printing opens your browser&apos;s print dialog (choose &ldquo;Save as PDF&rdquo; to
            download).
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-lg border shadow-sm">{children(ref)}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={() => print()}>
            <Printer aria-hidden="true" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

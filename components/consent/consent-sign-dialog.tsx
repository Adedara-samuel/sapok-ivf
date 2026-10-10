"use client";

import { useState } from "react";
import { z } from "zod";
import { TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { SignaturePad } from "@/components/shared/signature-pad";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import type { ConsentTemplateConfig } from "@/lib/constants/clinical";
import { useConsentStore } from "@/lib/stores/consent";

const signForm = z.object({
  signerName: z.string().trim().min(3, "Enter the full name(s) of the signer(s)"),
  witnessName: z.string().optional(),
});
type SignForm = z.infer<typeof signForm>;

export function ConsentSignDialog({
  episodeId,
  template,
  defaultSigner,
  open,
  onOpenChange,
}: {
  episodeId: string;
  template: ConsentTemplateConfig | null;
  defaultSigner: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const run = useRunAction();
  const sign = useConsentStore((s) => s.sign);
  const [sig, setSig] = useState("");
  const [sigError, setSigError] = useState<string | null>(null);
  const form = useZodForm<SignForm>(signForm, { signerName: defaultSigner, witnessName: "" });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setSig("");
          setSigError(null);
          form.reset({ signerName: defaultSigner, witnessName: "" });
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {template?.title} <span className="text-muted-foreground text-sm font-normal">({template?.version})</span>
          </DialogTitle>
          <DialogDescription>
            Read the consent with the patient, then capture the signature and witness.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted/50 max-h-48 overflow-y-auto rounded-lg border p-3 text-sm leading-relaxed">
          {template?.body}
        </div>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => {
              if (!template) return;
              if (!sig) {
                setSigError("A signature is required.");
                return;
              }
              const res = run(
                () =>
                  sign(episodeId, {
                    template: template.id,
                    version: template.version,
                    signerName: v.signerName,
                    witnessName: v.witnessName,
                    signatureDataUrl: sig,
                    validityMonths: template.validityMonths,
                  }),
                { success: `${template.title} signed`, setError: form.setError },
              );
              if (res) onOpenChange(false);
            })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="signerName" label="Signed by" required />
              <TextField control={form.control} name="witnessName" label="Witness" />
            </div>
            <SignaturePad
              onChange={(d) => {
                setSig(d);
                if (d) setSigError(null);
              }}
              invalid={Boolean(sigError)}
              describedBy={sigError ? "consent-sig-error" : undefined}
            />
            {sigError ? (
              <p id="consent-sig-error" className="text-destructive text-sm">
                {sigError}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Save signed consent</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

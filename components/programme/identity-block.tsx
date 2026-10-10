"use client";

import { useEffect, useRef, useState } from "react";
import { EyeOff, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { usePermission } from "@/hooks/use-permission";
import { audit } from "@/lib/stores/audit";
import { fullName, type Person } from "@/lib/schemas/person";
import { logSensitiveView } from "@/lib/services/workflows";
import { formatDate } from "@/lib/utils/dates";

/** Shows donor/surrogate identity only to privileged roles; others may break glass (audited). */
export function IdentityBlock({
  person,
  code,
  entity,
}: {
  person: Person | undefined;
  code: string;
  entity: "donor" | "surrogate";
}) {
  const privileged = usePermission("donors.identity");
  const clinical = usePermission("clinical.view");
  const [revealed, setRevealed] = useState(false);
  const logged = useRef<string | null>(null);
  useEffect(() => {
    if (privileged && person && logged.current !== person.id) {
      logged.current = person.id;
      logSensitiveView(entity, `Viewed identity of ${code}`, person.id);
    }
  }, [privileged, person, entity, code]);
  if (!person) return null;
  const visible = privileged || revealed;
  return (
    <div className="rounded-lg border p-3 text-sm">
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
        {visible ? (
          <ShieldCheck className="size-3.5" aria-hidden="true" />
        ) : (
          <EyeOff className="size-3.5" aria-hidden="true" />
        )}{" "}
        Identity
      </p>
      {visible ? (
        <dl className="grid grid-cols-2 gap-2">
          <div>
            <dt className="text-muted-foreground text-xs">Name</dt>
            <dd className="font-medium">{fullName(person)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">PRN</dt>
            <dd>{person.prn}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Phone</dt>
            <dd>{person.phone}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Date of birth</dt>
            <dd>{formatDate(person.dob)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground text-xs">Address</dt>
            <dd>
              {person.address}, {person.city}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="grid gap-2">
          <p className="text-muted-foreground">
            Identity is hidden for your role. Only the anonymised code {code} is shown.
          </p>
          {clinical ? (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline" className="w-fit">
                  <ShieldAlert aria-hidden="true" /> Break glass
                </Button>
              }
              title="Emergency access to identity"
              description="Break-glass access is recorded in the audit log and reviewed by the medical director."
              reasonLabel="Clinical reason for emergency access"
              confirmLabel="Reveal identity"
              onConfirm={(reason) => {
                audit("break-glass", entity, `Break-glass: viewed identity of ${code} — ${reason}`, person.id);
                setRevealed(true);
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

"use client";

import { Fragment } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionCard } from "@/components/shared/section-card";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { CAPABILITY_GROUPS, ROLE_LABELS } from "@/lib/permissions";
import { StaffRole } from "@/lib/schemas/admin";
import { useSettingsStore } from "@/lib/stores/settings";

export function PermissionMatrix() {
  const run = useRunAction();
  const canEdit = usePermission("admin.settings");
  const matrix = useSettingsStore((s) => s.matrix);
  const toggle = useSettingsStore((s) => s.toggleCapability);
  return (
    <SectionCard
      title="Roles & permissions"
      description={
        canEdit
          ? "Changes apply immediately to every screen, menu and action, and are audited."
          : "Read-only for your role."
      }
    >
      <div className="max-h-[70vh] overflow-auto rounded-xl border">
        <Table>
          <TableHeader className="bg-muted sticky top-0 z-10">
            <TableRow>
              <TableHead className="bg-muted sticky left-0 z-20 min-w-48">Capability</TableHead>
              {StaffRole.options.map((r) => (
                <TableHead key={r} className="text-center text-xs whitespace-nowrap">
                  {ROLE_LABELS[r]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {CAPABILITY_GROUPS.map((g) => (
              <Fragment key={g.label}>
                <TableRow className="bg-muted/40">
                  <TableCell
                    colSpan={StaffRole.options.length + 1}
                    className="text-xs font-semibold tracking-wide uppercase"
                  >
                    {g.label}
                  </TableCell>
                </TableRow>
                {g.items.map((cap) => (
                  <TableRow key={cap}>
                    <TableCell className="bg-card sticky left-0 font-mono text-xs">{cap}</TableCell>
                    {StaffRole.options.map((r) => (
                      <TableCell key={r} className="text-center">
                        <Checkbox
                          checked={matrix[r].includes(cap)}
                          disabled={!canEdit}
                          aria-label={`${ROLE_LABELS[r]}: ${cap}`}
                          onCheckedChange={() =>
                            run(
                              () => {
                                toggle(r, cap);
                                return true;
                              },
                              {
                                success: `${matrix[r].includes(cap) ? "Revoked" : "Granted"} ${cap} for ${ROLE_LABELS[r]}`,
                              },
                            )
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

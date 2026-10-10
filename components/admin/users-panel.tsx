"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";
import { KeyRound, Pencil, Plus, UserCheck, UserX } from "lucide-react";
import { SelectField, TextField, TextareaField } from "@/components/forms/fields";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { SectionCard } from "@/components/shared/section-card";
import { StatusChip } from "@/components/shared/status-chip";
import { usePermission } from "@/hooks/use-permission";
import { useRunAction } from "@/hooks/use-run-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { APP_CONFIG } from "@/lib/config";
import { ROLE_LABELS } from "@/lib/permissions";
import { resetUserPassword } from "@/lib/services/auth";
import { phone } from "@/lib/schemas/common";
import { StaffRole, type Staff } from "@/lib/schemas/admin";
import { useSettingsStore } from "@/lib/stores/settings";
import { useStaffStore } from "@/lib/stores/staff";

const userForm = z.object({
  name: z.string().trim().min(3, "Enter the full name"),
  role: StaffRole,
  email: z.email("Enter a valid email address"),
  phone,
  branchId: z.string().min(1, "Choose a branch"),
  note: z.string().optional(),
});
type UserForm = z.infer<typeof userForm>;

export function UsersPanel() {
  const run = useRunAction();
  const canEdit = usePermission("admin.users");
  const staff = useStaffStore((s) => s.staff);
  const add = useStaffStore((s) => s.add);
  const update = useStaffStore((s) => s.update);
  const setActive = useStaffStore((s) => s.setActive);
  const branches = useSettingsStore((s) => s.branches);
  const [editing, setEditing] = useState<Staff | "new" | null>(null);
  const form = useZodForm<UserForm>(userForm, {
    name: "",
    role: "nurse",
    email: "",
    phone: "",
    branchId: "BR-01",
    note: "",
  });

  const open = (s: Staff | "new") => {
    form.reset(
      s === "new"
        ? { name: "", role: "nurse", email: "", phone: "", branchId: "BR-01", note: "" }
        : { name: s.name, role: s.role, email: s.email, phone: s.phone, branchId: s.branchId, note: s.note ?? "" },
    );
    setEditing(s);
  };

  const columns: ColumnDef<Staff, unknown>[] = [
    { accessorKey: "id", header: "ID" },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    { accessorKey: "role", header: "Role", cell: ({ row }) => ROLE_LABELS[row.original.role] },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "phone", header: "Phone" },
    {
      accessorKey: "branchId",
      header: "Branch",
      cell: ({ row }) => branches.find((b) => b.id === row.original.branchId)?.short ?? row.original.branchId,
    },
    { accessorKey: "note", header: "Note" },
    {
      id: "active",
      header: "Status",
      accessorFn: (s) => (s.active ? "active" : "inactive"),
      cell: ({ row }) => (
        <StatusChip
          status={row.original.active ? "approved" : "cancelled"}
          label={row.original.active ? "Active" : "Deactivated"}
        />
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      cell: ({ row }) =>
        canEdit ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => open(row.original)}>
              <Pencil aria-hidden="true" /> Edit
            </Button>
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="ghost">
                  <KeyRound aria-hidden="true" /> Reset password
                </Button>
              }
              title={`Reset password for ${row.original.name}?`}
              description={`Their personal password is removed and they sign in with the demo password (${APP_CONFIG.demoPassword}) until they set a new one on their profile.`}
              confirmLabel="Reset password"
              onConfirm={() => {
                run(
                  () => {
                    resetUserPassword(row.original.id);
                    return true;
                  },
                  { success: `Password reset for ${row.original.name}` },
                );
              }}
            />
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="ghost">
                  {row.original.active ? <UserX aria-hidden="true" /> : <UserCheck aria-hidden="true" />}{" "}
                  {row.original.active ? "Deactivate" : "Reactivate"}
                </Button>
              }
              destructive={row.original.active}
              title={`${row.original.active ? "Deactivate" : "Reactivate"} ${row.original.name}?`}
              description={
                row.original.active
                  ? "They will no longer be able to sign in. History and audit records are kept."
                  : "They will be able to sign in again."
              }
              confirmLabel={row.original.active ? "Deactivate" : "Reactivate"}
              onConfirm={() => {
                run(
                  () => {
                    setActive(row.original.id, !row.original.active);
                    return true;
                  },
                  { success: `${row.original.name} ${row.original.active ? "deactivated" : "reactivated"}` },
                );
              }}
            />
          </div>
        ) : null,
    },
  ];

  return (
    <SectionCard
      title="Users"
      description={`Staff accounts. Users sign in with the demo password (${APP_CONFIG.demoPassword}) until they set their own on My profile.`}
      actions={
        canEdit ? (
          <Button size="sm" onClick={() => open("new")}>
            <Plus aria-hidden="true" /> Add user
          </Button>
        ) : null
      }
    >
      <DataTable
        data={staff}
        columns={columns}
        searchPlaceholder="Search users…"
        exportName="users"
        exportTitle="Users"
        initialHidden={{ note: false }}
      />
      <Dialog open={editing !== null} onOpenChange={(o) => (!o ? setEditing(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add user" : `Edit ${editing?.name ?? ""}`}</DialogTitle>
            <DialogDescription>
              Role controls what the user can see and do (see the permission matrix).
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              noValidate
              className="grid gap-4"
              onSubmit={form.handleSubmit((v) => {
                const res = run(
                  () => (editing === "new" ? add({ ...v, active: true }) : editing ? update(editing.id, v) : undefined),
                  { success: editing === "new" ? "User added" : "User updated", setError: form.setError },
                );
                if (res) setEditing(null);
              })}
            >
              <TextField control={form.control} name="name" label="Full name" required />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  control={form.control}
                  name="role"
                  label="Role"
                  required
                  options={StaffRole.options.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                />
                <SelectField
                  control={form.control}
                  name="branchId"
                  label="Branch"
                  required
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                />
                <TextField control={form.control} name="email" label="Email" type="email" required />
                <TextField control={form.control} name="phone" label="Phone" type="tel" required />
              </div>
              <TextareaField control={form.control} name="note" label="Note" rows={2} />
              <DialogFooter>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

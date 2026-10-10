"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditPanel } from "@/components/admin/audit-panel";
import { ConfigPanel } from "@/components/admin/config-panel";
import { DataToolsPanel } from "@/components/admin/data-tools-panel";
import { PermissionMatrix } from "@/components/admin/permission-matrix";
import { UsersPanel } from "@/components/admin/users-panel";
import { PageHeader } from "@/components/shared/page-header";
import { useCan } from "@/hooks/use-permission";

export function AdminView() {
  const router = useRouter();
  const params = useSearchParams();
  const can = useCan();
  const tabs = [
    { value: "users", label: "Users", show: can("admin.users") || can("admin.view") },
    { value: "roles", label: "Roles & permissions", show: true },
    { value: "config", label: "Configuration", show: true },
    { value: "audit", label: "Audit log", show: can("audit.view") || can("admin.settings") },
    { value: "data", label: "Data tools", show: true },
  ].filter((t) => t.show);
  const tab = tabs.find((t) => t.value === params.get("tab"))?.value ?? tabs[0]?.value ?? "roles";
  return (
    <>
      <PageHeader
        title="Administration"
        description="Users, permissions, configuration, audit trail and demo data tools."
        crumbs={[{ label: "Management" }, { label: "Admin" }]}
      />
      <Tabs value={tab} onValueChange={(v) => router.replace(`/admin?tab=${v}`, { scroll: false })}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <PermissionMatrix />
        </TabsContent>
        <TabsContent value="config" className="mt-4">
          <ConfigPanel />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditPanel />
        </TabsContent>
        <TabsContent value="data" className="mt-4">
          <DataToolsPanel />
        </TabsContent>
      </Tabs>
    </>
  );
}

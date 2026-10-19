"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BrandLogo } from "@/components/layout/brand-logo";
import { NAV, type NavItem } from "@/components/layout/nav";
import { useCan } from "@/hooks/use-permission";
import { useSettingsStore } from "@/lib/stores/settings";
import { useUiStore } from "@/lib/stores/ui";
import { cn } from "@/lib/utils/cn";

function isActive(pathname: string, search: string, href: string): boolean {
  const [path, query] = href.split("?");
  if (query) return pathname === path && search.includes(query);
  if (path === "/patients")
    return pathname === "/patients" || (pathname.startsWith("/patients/") && pathname !== "/patients/new");
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const can = useCan();
  const clinicName = useSettingsStore((s) => s.clinic.clinicName);

  const renderItem = (item: NavItem) => {
    const active =
      isActive(pathname, search, item.href) &&
      !item.children?.some((c) => c.href.includes("?") && isActive(pathname, search, c.href));
    const Icon = item.icon;
    const link = (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
      </Link>
    );
    const children = item.children?.filter((c) => !c.capability || can(c.capability)) ?? [];
    const open = !collapsed && children.length > 0 && pathname.startsWith(item.href.split("?")[0] ?? item.href);
    return (
      <li key={item.href}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ) : (
          link
        )}
        {open ? (
          <ul className="border-sidebar-border mt-1 ml-5 grid gap-0.5 border-l pl-3">
            {children.map((c) => {
              const childActive = c.href.includes("?") ? isActive(pathname, search, c.href) : pathname === c.href;
              return (
                <li key={c.href}>
                  <Link
                    href={c.href}
                    onClick={onNavigate}
                    aria-current={childActive ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-xs",
                      childActive
                        ? "text-sidebar-primary bg-sidebar-accent font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
        <BrandLogo compact className={collapsed ? "h-8" : "h-9"} />
        {!collapsed ? (
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-semibold">{clinicName}</span>
            <span className="text-muted-foreground block truncate text-[11px]">IVF &amp; fertility care</span>
          </span>
        ) : null}
      </div>
      <ScrollArea className="flex-1 px-2">
        <nav aria-label="Main" className="grid gap-5 py-3">
          {NAV.map((group) => {
            const items = group.items.filter((i) => can(i.capability));
            if (items.length === 0) return null;
            return (
              <div key={group.label}>
                {!collapsed ? (
                  <p className="text-muted-foreground mb-1 px-2.5 text-[11px] font-semibold tracking-wider uppercase">
                    {group.label}
                  </p>
                ) : null}
                <ul className="grid gap-0.5">{items.map(renderItem)}</ul>
              </div>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  return (
    <aside
      className={cn(
        "bg-sidebar border-sidebar-border no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
      aria-label="Sidebar"
    >
      <SidebarNav collapsed={collapsed} />
      <div className={cn("border-sidebar-border border-t p-2", collapsed && "flex justify-center")}>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className={cn(!collapsed && "w-full justify-start")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          {!collapsed ? "Collapse" : null}
        </Button>
      </div>
    </aside>
  );
}

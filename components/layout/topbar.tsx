"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Building2, CircleUser, LogOut, Menu, Moon, Search, Sparkles, Sun, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { SidebarNav } from "@/components/layout/sidebar";
import { ROLE_LABELS } from "@/lib/permissions";
import { StaffRole } from "@/lib/schemas/admin";
import { signOut, switchBranch, switchRole } from "@/lib/services/workflows";
import { useSessionStore } from "@/lib/stores/session";
import { useSettingsStore } from "@/lib/stores/settings";
import { useStaffStore } from "@/lib/stores/staff";
import { useUiStore } from "@/lib/stores/ui";

export function Topbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const branchId = useSessionStore((s) => s.branchId);
  const branches = useSettingsStore((s) => s.branches);
  const user = useStaffStore((s) => s.staff.find((x) => x.id === userId));
  const startTour = useUiStore((s) => s.startTour);

  return (
    <header className="bg-background/85 no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu aria-hidden="true" />
      </Button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <button
        type="button"
        onClick={onOpenPalette}
        className="bg-muted/60 text-muted-foreground hover:bg-muted focus-visible:ring-ring flex h-9 w-full max-w-md items-center gap-2 rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
        aria-keyshortcuts="Control+K"
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="truncate">Search patients, PRN, IVF no, phone…</span>
        <kbd className="bg-background ml-auto hidden rounded border px-1.5 text-[10px] font-medium sm:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 md:gap-2">
        {branches.length > 1 ? (
          <Select value={branchId} onValueChange={(v) => switchBranch(v, branches.find((b) => b.id === v)?.name ?? v)}>
            <SelectTrigger size="sm" className="hidden w-40 md:flex" aria-label="Switch branch">
              <Building2 aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.short}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <UserCog aria-hidden="true" />
              <span className="sr-only">Switch demo role, current role:</span>
              {role ? ROLE_LABELS[role] : "Role"}
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                demo
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>View the app as…</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={role ?? ""} onValueChange={(v) => switchRole(StaffRole.parse(v))}>
              {StaffRole.options.map((r) => (
                <DropdownMenuRadioItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <NotificationsBell />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
        >
          {resolvedTheme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <span className="sr-only">User menu</span>
              <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full text-xs font-semibold">
                {user?.name.replace(/^Dr\.\s*/, "").slice(0, 1) ?? "?"}
              </span>
              <span className="hidden text-left text-xs leading-tight xl:block">
                <span className="block font-medium">{user?.name}</span>
                <span className="text-muted-foreground">{role ? ROLE_LABELS[role] : ""}</span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block">{user?.name}</span>
              <span className="text-muted-foreground block text-xs font-normal">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/profile")}>
              <CircleUser aria-hidden="true" /> My profile & password
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                startTour();
                router.push("/dashboard");
              }}
            >
              <Sparkles aria-hidden="true" /> Start guided demo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                signOut();
                router.replace("/login");
              }}
            >
              <LogOut aria-hidden="true" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, LayoutDashboard, LifeBuoy, LogOut, Moon, Plus, Settings2, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { PlatformLogo } from "@/components/layout/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePlatformStore } from "@/lib/stores/platform";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/platform", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/platform/hospitals", label: "Hospitals", icon: Building2 },
  { href: "/platform/hospitals/new", label: "Onboard hospital", icon: Plus, exact: true },
  { href: "/platform/tickets", label: "Support desk", icon: LifeBuoy },
  { href: "/platform/settings", label: "Settings & audit", icon: Settings2 },
];

/** Super-admin console frame. Only reachable after signing in as the platform owner on the normal login page. */
export function PlatformShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const signedIn = usePlatformStore((s) => s.superAdmin);
  const signOut = usePlatformStore((s) => s.signOutSuperAdmin);
  const openTickets = usePlatformStore(
    (s) => s.tickets.filter((t) => t.status === "open" || t.status === "in-progress").length,
  );

  useEffect(() => {
    if (!signedIn) router.replace("/login");
  }, [signedIn, router]);
  if (!signedIn) return null;

  const active = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || (pathname.startsWith(`${href}/`) && !pathname.endsWith("/new"));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-background/90 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-3 px-4 md:px-6">
          <PlatformLogo className="h-9" />
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Super admin
          </Badge>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
            >
              {resolvedTheme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                signOut();
                router.replace("/login");
              }}
            >
              <LogOut aria-hidden="true" /> Sign out
            </Button>
          </div>
        </div>
        <nav aria-label="Platform" className="mx-auto w-full max-w-[1440px] overflow-x-auto px-4 md:px-6">
          <ul className="flex gap-1 pb-2">
            {LINKS.map((l) => {
              const Icon = l.icon;
              const on = active(l.href, l.exact);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex h-8 items-center gap-2 rounded-md px-3 text-sm whitespace-nowrap",
                      on
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {l.label}
                    {l.href === "/platform/tickets" && openTickets > 0 ? (
                      <Badge className="h-4 px-1 text-[10px]">{openTickets}</Badge>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-6">{children}</main>
      <footer className="text-muted-foreground border-t px-4 py-3 text-xs md:px-6">
        Overcare platform console · demo — hospitals, payments and tickets are synthetic.
      </footer>
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useActiveTenant } from "@/hooks/use-tenant";

const DEFAULT_PRIMARY = "#0f766e";

/** Relative luminance → whether white text is readable on the colour. */
function prefersWhiteText(hex: string): boolean {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45;
}

/**
 * Re-themes the app with the hospital's brand colour. Only the primary family is overridden; status colours
 * (success, warning, destructive) stay fixed so they keep their meaning in every hospital.
 */
export function TenantTheme() {
  const tenant = useActiveTenant();
  const pathname = usePathname();
  const color = tenant?.primaryColor?.toLowerCase();
  // the super-admin console keeps the platform's own colours
  if (!color || color === DEFAULT_PRIMARY || pathname.startsWith("/platform")) return null;
  const fg = prefersWhiteText(color) ? "#ffffff" : "#0f1f20";
  const css = `
:root{--primary:${color};--primary-hover:color-mix(in srgb,${color} 85%,black);--primary-foreground:${fg};--ring:${color};--chart-1:${color};--accent:color-mix(in srgb,${color} 10%,white);--sidebar-primary:${color};--sidebar-primary-foreground:${fg};--sidebar-accent:color-mix(in srgb,${color} 10%,white);--sidebar-ring:${color};}
.dark{--primary:color-mix(in srgb,${color} 55%,white);--primary-hover:color-mix(in srgb,${color} 40%,white);--primary-foreground:#0b1213;--ring:color-mix(in srgb,${color} 55%,white);--chart-1:color-mix(in srgb,${color} 55%,white);--accent:color-mix(in srgb,${color} 22%,#0b1213);--sidebar-primary:color-mix(in srgb,${color} 55%,white);--sidebar-primary-foreground:#0b1213;--sidebar-accent:color-mix(in srgb,${color} 22%,#0b1213);--sidebar-ring:color-mix(in srgb,${color} 55%,white);}`;
  return <style data-tenant-theme={tenant?.slug}>{css}</style>;
}

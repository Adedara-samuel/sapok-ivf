import {
  Baby,
  BarChart3,
  ClipboardList,
  Clock,
  HeartHandshake,
  LayoutDashboard,
  MessagesSquare,
  Microscope,
  Pill,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Capability } from "@/lib/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  capability: Capability;
  children?: { label: string; href: string; capability?: Capability }[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "Front office",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, capability: "dashboard.view" },
      { label: "Waiting List", href: "/waiting-list", icon: Clock, capability: "waiting.view" },
      {
        label: "Patients",
        href: "/patients",
        icon: Users,
        capability: "patients.view",
        children: [
          { label: "Existing Patients", href: "/patients" },
          { label: "New Registration", href: "/patients/new", capability: "patients.create" },
        ],
      },
    ],
  },
  {
    label: "Programmes",
    items: [
      { label: "Counselling", href: "/counselling", icon: MessagesSquare, capability: "counselling.view" },
      { label: "Donors", href: "/donors", icon: HeartHandshake, capability: "donors.view" },
      { label: "Surrogates", href: "/surrogates", icon: Baby, capability: "surrogates.view" },
    ],
  },
  {
    label: "Clinical services",
    items: [
      { label: "Embryology Lab", href: "/embryology", icon: Microscope, capability: "embryology.view" },
      { label: "Pharmacy", href: "/pharmacy", icon: Pill, capability: "pharmacy.view" },
      { label: "Billing", href: "/billing", icon: Wallet, capability: "billing.view" },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3, capability: "reports.view" },
      {
        label: "Requests",
        href: "/requests",
        icon: ClipboardList,
        capability: "requests.create",
        children: [
          { label: "Item", href: "/requests?type=item" },
          { label: "Leave", href: "/requests?type=leave" },
          { label: "Job", href: "/requests?type=job" },
          { label: "Manpower", href: "/requests?type=manpower" },
          { label: "Reimbursement", href: "/requests?type=reimbursement" },
        ],
      },
      { label: "Admin", href: "/admin", icon: ShieldCheck, capability: "admin.view" },
    ],
  },
];

export const NEW_REGISTRATION_ICON = UserPlus;

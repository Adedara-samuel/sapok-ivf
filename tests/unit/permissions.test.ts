import { describe, expect, it } from "vitest";
import { capabilityForPath, DEFAULT_ROLE_CAPABILITIES, hasCapability } from "@/lib/permissions";
import { StaffRole } from "@/lib/schemas/admin";

const canOpen = (role: StaffRole, path: string): boolean => {
  const cap = capabilityForPath(path);
  return cap === null || hasCapability(DEFAULT_ROLE_CAPABILITIES, role, cap);
};

const MATRIX: Record<StaffRole, { allowed: string[]; denied: string[] }> = {
  frontdesk: {
    allowed: ["/dashboard", "/waiting-list", "/patients/new", "/billing", "/accounts", "/accounts/WAL-0001"],
    denied: ["/embryology", "/admin", "/pharmacy", "/subscription"],
  },
  doctor: { allowed: ["/patients/abc", "/donors", "/embryology", "/reports"], denied: ["/billing", "/admin"] },
  embryologist: { allowed: ["/embryology", "/patients"], denied: ["/billing", "/pharmacy", "/admin"] },
  nurse: { allowed: ["/waiting-list", "/patients/xyz"], denied: ["/billing", "/reports", "/admin", "/accounts"] },
  counsellor: { allowed: ["/counselling", "/donors", "/surrogates"], denied: ["/billing", "/embryology"] },
  pharmacist: { allowed: ["/pharmacy", "/reports"], denied: ["/billing", "/embryology", "/admin"] },
  lab: { allowed: ["/patients"], denied: ["/billing", "/pharmacy", "/admin"] },
  radiology: { allowed: ["/patients"], denied: ["/billing", "/embryology"] },
  accountant: { allowed: ["/billing", "/reports", "/accounts"], denied: ["/embryology", "/admin", "/counselling"] },
  hr: { allowed: ["/requests", "/admin"], denied: ["/patients", "/billing"] },
  manager: { allowed: ["/reports", "/requests", "/billing", "/admin"], denied: ["/patients/new"] },
  admin: { allowed: ["/admin", "/billing", "/embryology", "/patients/new", "/accounts", "/subscription"], denied: [] },
};

describe("role permission matrix", () => {
  it.each(StaffRole.options)("%s: allowed and denied routes", (role) => {
    MATRIX[role].allowed.forEach((p) => expect({ role, p, ok: canOpen(role, p) }).toEqual({ role, p, ok: true }));
    MATRIX[role].denied.forEach((p) => expect({ role, p, ok: canOpen(role, p) }).toEqual({ role, p, ok: false }));
  });

  it("longest route prefix wins", () => {
    expect(capabilityForPath("/patients/new")).toBe("patients.create");
    expect(capabilityForPath("/patients/PT-0001")).toBe("patients.view");
    expect(capabilityForPath("/login")).toBeNull();
  });
});

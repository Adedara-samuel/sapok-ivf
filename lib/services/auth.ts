import { z } from "zod";
import { APP_CONFIG } from "@/lib/config";
import { audit } from "@/lib/stores/audit";
import { assert, DomainError, validate } from "@/lib/stores/core";
import { useCredentialStore } from "@/lib/stores/credentials";
import { currentActorId } from "@/lib/stores/session";
import { useStaffStore } from "@/lib/stores/staff";
import { nowIso } from "@/lib/utils/dates";

export const PASSWORD_RULES: { id: string; label: string; test: (v: string) => boolean }[] = [
  { id: "length", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { id: "upper", label: "An uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { id: "lower", label: "A lowercase letter", test: (v) => /[a-z]/.test(v) },
  { id: "digit", label: "A number", test: (v) => /\d/.test(v) },
  { id: "symbol", label: "A symbol (e.g. ! @ # $)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export const newPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(64, "Use 64 characters or fewer")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/\d/, "Include a number")
  .regex(/[^A-Za-z0-9]/, "Include a symbol");

export const changePasswordSchema = z
  .object({
    next: newPasswordSchema,
    confirm: z.string().min(1, "Re-enter the new password"),
  })
  .refine((v) => v.next === v.confirm, { message: "The passwords do not match", path: ["confirm"] });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** SHA-256 of the password salted with the user id (demo-grade; a real system hashes server-side). */
export async function hashPassword(staffId: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${staffId}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(staffId: string, password: string): Promise<boolean> {
  const stored = useCredentialStore.getState().credentials[staffId];
  if (!stored) return password === APP_CONFIG.demoPassword;
  return (await hashPassword(staffId, password)) === stored.hash;
}

export function hasCustomPassword(staffId: string): boolean {
  return Boolean(useCredentialStore.getState().credentials[staffId]);
}

/** Signed-in user sets a new password (already authenticated, so no current password). Throws DomainError with field errors. */
export async function changeOwnPassword(input: ChangePasswordInput): Promise<void> {
  const v = validate(changePasswordSchema, input);
  const staffId = currentActorId();
  const member = useStaffStore.getState().staff.find((s) => s.id === staffId);
  if (!member) throw new DomainError("You need to be signed in to change your password");
  if (await verifyPassword(staffId, v.next)) {
    throw new DomainError("Choose a password different from your current one", {
      next: "Choose a password different from your current one",
    });
  }
  useCredentialStore.getState().set(staffId, { hash: await hashPassword(staffId, v.next), changedAt: nowIso() });
  audit("update", "credential", "Changed own password", staffId);
}

/** Admin action: return a user to the demo password. */
export function resetUserPassword(staffId: string): void {
  const member = useStaffStore.getState().staff.find((s) => s.id === staffId);
  assert(member, "User not found");
  useCredentialStore.getState().clear(staffId);
  audit("update", "credential", `Reset password for ${member.name} to the demo default`, staffId);
}

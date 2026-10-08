import { z } from "zod";
import { id, isoDate, isoDateTime, optionalEmail, PayerCategory, phone } from "@/lib/schemas/common";

export const PersonRole = z.enum(["patient", "partner", "donor", "surrogate"]);
export type PersonRole = z.infer<typeof PersonRole>;

export const TITLES = ["Mr", "Mrs", "Ms", "Dr", "Chief", "Engr"] as const;
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const GENOTYPES = ["AA", "AS", "SS", "AC", "SC"] as const;
export const MARITAL_STATUSES = ["single", "married", "divorced", "widowed"] as const;

export const nextOfKinSchema = z.object({
  name: z.string().min(2, "Enter the next of kin's name"),
  phone,
  relationship: z.string().min(2, "Enter the relationship"),
});

export const payerSchema = z.object({
  category: PayerCategory,
  sponsor: z.string().optional(),
  company: z.string().optional(),
  memberId: z.string().optional(),
});

export const personSchema = z.object({
  id,
  prn: z.string().min(1),
  title: z.enum(TITLES).optional(),
  firstName: z.string().min(2, "First name needs at least 2 letters"),
  lastName: z.string().min(2, "Last name needs at least 2 letters"),
  otherNames: z.string().optional(),
  sex: z.enum(["F", "M"]),
  dob: isoDate,
  maritalStatus: z.enum(MARITAL_STATUSES),
  phone,
  email: optionalEmail,
  address: z.string().min(5, "Enter a full address"),
  city: z.string().min(2, "Enter the city"),
  state: z.string().min(2, "Enter the state"),
  nextOfKin: nextOfKinSchema,
  payer: payerSchema,
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  genotype: z.enum(GENOTYPES).optional(),
  allergies: z.array(z.string()),
  photoUrl: z.string().optional(),
  roles: z.array(PersonRole).min(1),
  branchId: id,
  createdAt: isoDateTime,
});
export type Person = z.infer<typeof personSchema>;

export function fullName(p: Pick<Person, "firstName" | "lastName" | "title">, withTitle = false): string {
  return `${withTitle && p.title ? `${p.title} ` : ""}${p.firstName} ${p.lastName}`;
}

import { z } from "zod";
import { id, isoDate, phone } from "@/lib/schemas/common";

export const ClientType = z.enum(["new", "returning", "donor-recipient", "surrogacy-intending"]);
export type ClientType = z.infer<typeof ClientType>;

export const counsellingSchema = z.object({
  id,
  personId: id,
  partnerId: id.optional(),
  date: isoDate,
  complexion: z.string().optional(),
  afc: z.number().int().optional(),
  lmp: isoDate.optional(),
  bloodGroup: z.string().optional(),
  wifePhone: phone.optional(),
  husbandPhone: phone.optional(),
  email: z.email("Enter a valid email address").optional(),
  referral: z.string().optional(),
  children: z.number().int().nonnegative(),
  clientType: ClientType,
  notes: z.string().min(3, "Write at least 3 characters"),
  checklist: z.array(z.string()),
  counsellorId: id,
});
export type Counselling = z.infer<typeof counsellingSchema>;

export const COUNSELLING_CHECKLISTS: Record<ClientType, readonly string[]> = {
  new: [
    "Explained IVF pathway",
    "Discussed success rates by age",
    "Reviewed costs and packages",
    "Baseline tests explained",
  ],
  returning: ["Reviewed previous cycle", "Emotional wellbeing check", "Discussed next protocol"],
  "donor-recipient": [
    "Donor anonymity explained",
    "Phenotype matching discussed",
    "Legal parentage explained",
    "Donor consent reviewed",
  ],
  "surrogacy-intending": [
    "Surrogacy pathway explained",
    "Legal agreement reviewed",
    "Surrogate support plan",
    "Costs and coordination fee",
  ],
};

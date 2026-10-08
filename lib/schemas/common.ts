import { z } from "zod";

export const id = z.string().min(1);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
export const isoDateTime = z.iso.datetime({ offset: true });
export const phone = z.string().regex(/^0[789][01]\d{8}$/, "Enter a valid Nigerian mobile number");
export const money = z.number().nonnegative("Amount cannot be negative");
export const optionalEmail = z.email("Enter a valid email address").optional().or(z.literal(""));

export const PayerCategory = z.enum(["self-pay", "corporate", "hmo", "referral"]);
export type PayerCategory = z.infer<typeof PayerCategory>;

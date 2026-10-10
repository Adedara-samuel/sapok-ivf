"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues, type FieldValues, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";

/** react-hook-form wired to a Zod schema whose input and output types are identical. */
export function useZodForm<T extends FieldValues>(
  schema: z.ZodType<T, T>,
  defaultValues: DefaultValues<T>,
): UseFormReturn<T> {
  return useForm<T>({ resolver: zodResolver(schema), defaultValues, mode: "onTouched" });
}

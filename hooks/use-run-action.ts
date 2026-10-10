"use client";

import { useCallback } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import { isDomainError } from "@/lib/stores/core";

/**
 * Runs a store action, shows a toast, and maps DomainError field errors back onto the form.
 * Returns the action result, or undefined if it failed.
 */
export function useRunAction() {
  return useCallback(
    <T, F extends FieldValues = FieldValues>(
      fn: () => T,
      opts: { success?: string | ((r: T) => string); setError?: UseFormSetError<F> } = {},
    ): T | undefined => {
      try {
        const result = fn();
        if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(result) : opts.success);
        return result;
      } catch (error) {
        if (isDomainError(error)) {
          const setError = opts.setError;
          if (setError)
            Object.entries(error.fieldErrors).forEach(([field, message]) => setError(field as Path<F>, { message }));
          toast.error(error.message);
        } else {
          console.error(error);
          toast.error("Something went wrong. Please try again.");
        }
        return undefined;
      }
    },
    [],
  );
}

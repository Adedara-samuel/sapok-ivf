"use client";

import { useEffect } from "react";

/** Warns before the tab/window is closed or reloaded while a form has unsaved changes. */
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

/** Use in dialog onOpenChange: confirm before discarding a dirty form. */
export function confirmDiscard(dirty: boolean): boolean {
  return !dirty || window.confirm("You have unsaved changes. Discard them?");
}

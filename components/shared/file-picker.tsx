"use client";

import { useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** shadcn-styled file chooser (mock upload): shows the chosen file name with a clear button. */
export function FilePicker({
  id,
  accept,
  fileName,
  onChange,
  label = "Choose file",
}: {
  id: string;
  accept?: string;
  fileName?: string;
  onChange: (file: File | undefined) => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={ref}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          onChange(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}>
        <Paperclip aria-hidden="true" /> {fileName ? "Replace file" : label}
      </Button>
      {fileName ? (
        <span className="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs">
          {fileName}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-5"
            onClick={() => onChange(undefined)}
            aria-label={`Remove ${fileName}`}
          >
            <X className="size-3" />
          </Button>
        </span>
      ) : (
        <span className="text-muted-foreground text-xs">No file chosen</span>
      )}
    </div>
  );
}

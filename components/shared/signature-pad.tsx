"use client";

import { useEffect, useRef, useState } from "react";
import SignaturePadLib from "signature_pad";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/** Drawn signature; calls onChange with a PNG data URL (or "" when cleared). */
export function SignaturePad({
  onChange,
  label = "Signature",
  invalid,
  describedBy,
}: {
  onChange: (dataUrl: string) => void;
  label?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const onChangeRef = useRef(onChange);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      padRef.current?.clear();
      setEmpty(true);
      onChangeRef.current("");
    };
    const pad = new SignaturePadLib(canvas, {
      penColor: "#0F1F20",
      backgroundColor: "rgba(255,255,255,1)",
      minWidth: 0.8,
      maxWidth: 2.2,
    });
    padRef.current = pad;
    const end = () => {
      setEmpty(pad.isEmpty());
      onChangeRef.current(pad.isEmpty() ? "" : pad.toDataURL("image/png"));
    };
    pad.addEventListener("endStroke", end);
    resize();
    window.addEventListener("resize", resize);
    return () => {
      pad.removeEventListener("endStroke", end);
      pad.off();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            padRef.current?.clear();
            setEmpty(true);
            onChange("");
          }}
        >
          <Eraser aria-hidden="true" /> Clear
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        className={cn("h-36 w-full touch-none rounded-lg border bg-white", invalid && "border-destructive")}
        role="img"
        aria-label={`${label} pad. Draw with mouse, pen or finger.`}
        aria-describedby={describedBy}
      />
      <p className="text-muted-foreground text-xs">{empty ? "Sign inside the box." : "Signature captured."}</p>
    </div>
  );
}

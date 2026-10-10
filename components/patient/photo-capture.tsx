"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SIZE = 200;

function toThumbnail(source: CanvasImageSource, w: number, h: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const side = Math.min(w, h);
  ctx.drawImage(source, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIZE, SIZE);
  return canvas.toDataURL("image/jpeg", 0.8);
}

/** Patient photo from webcam or file, stored as a small JPEG data URL. */
export function PhotoCapture({ value, onChange }: { value?: string; onChange: (dataUrl: string | undefined) => void }) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 640, height: 480 } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      })
      .catch(() => setError("Camera not available. Allow camera access or upload a photo instead."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraOpen]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    onChange(toThumbnail(v, v.videoWidth, v.videoHeight));
    setCameraOpen(false);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file (JPG or PNG).");
      return;
    }
    const img = new Image();
    img.onload = () => {
      onChange(toThumbnail(img, img.naturalWidth, img.naturalHeight));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="bg-muted flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
        {value ? (
          <img src={value} alt="Patient photo" className="size-full object-cover" />
        ) : (
          <UserRound className="text-muted-foreground size-8" aria-hidden="true" />
        )}
      </div>
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              setCameraOpen(true);
            }}
          >
            <Camera aria-hidden="true" /> Use webcam
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <ImageUp aria-hidden="true" /> Upload photo
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
              <Trash2 aria-hidden="true" /> Remove
            </Button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Upload patient photo"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {error ? (
          <p className="text-destructive text-xs">{error}</p>
        ) : (
          <p className="text-muted-foreground text-xs">Optional. Square crop, stored only in this browser.</p>
        )}
      </div>
      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Take photo</DialogTitle>
            <DialogDescription>Centre the patient&apos;s face, then capture.</DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : (
            <video
              ref={videoRef}
              className="aspect-[4/3] w-full rounded-lg bg-black"
              muted
              playsInline
              aria-label="Camera preview"
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCameraOpen(false)}>
              Cancel
            </Button>
            <Button onClick={capture} disabled={Boolean(error)}>
              <Camera aria-hidden="true" /> Capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

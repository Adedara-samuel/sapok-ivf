"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintDialog } from "@/components/print/print-dialog";
import { GOBLET_COLOURS, positionCode, type StoragePosition } from "@/lib/schemas/embryology";
import { formatDate } from "@/lib/utils/dates";

function LabelCard({ pos, owner, prn }: { pos: StoragePosition; owner: string; prn: string }) {
  const [qr, setQr] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(JSON.stringify({ pos: positionCode(pos), item: pos.itemId ?? pos.id, prn }), {
      margin: 0,
      width: 160,
    }).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [pos, prn]);
  const colour = GOBLET_COLOURS[pos.goblet as keyof typeof GOBLET_COLOURS] ?? "#0F766E";
  return (
    <div
      className="flex w-[90mm] items-center gap-3 rounded border-2 bg-white p-2 text-[10px] text-black"
      style={{ borderColor: colour }}
    >
      {qr ? (
        <img src={qr} alt={`QR code for ${positionCode(pos)}`} className="size-20" />
      ) : (
        <div className="size-20 bg-neutral-100" />
      )}
      <div className="grid gap-0.5">
        <p className="text-[12px] font-bold">{positionCode(pos)}</p>
        <p className="font-semibold">{pos.label}</p>
        <p>
          {owner} · {prn}
        </p>
        <p>
          {pos.itemKind} · stored {formatDate(pos.storedAt)}
        </p>
        <p>Consent to {formatDate(pos.consentExpiry)}</p>
        <p className="font-semibold text-red-600">DEMO</p>
      </div>
    </div>
  );
}

export function StrawLabelPrint({ pos, owner, prn }: { pos: StoragePosition; owner: string; prn: string }) {
  return (
    <PrintDialog
      title={`Straw label — ${positionCode(pos)}`}
      documentTitle={`straw-${positionCode(pos)}`}
      auditEntity="straw-label"
      auditId={pos.id}
      trigger={
        <Button size="sm" variant="outline">
          <Tag aria-hidden="true" /> Print straw label
        </Button>
      }
    >
      {(ref) => (
        <div ref={ref} className="bg-white p-6">
          <LabelCard pos={pos} owner={owner} prn={prn} />
        </div>
      )}
    </PrintDialog>
  );
}

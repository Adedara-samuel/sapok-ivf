import type { Rng } from "@/lib/seed/rng";

/** Generates a simple hand-drawn looking signature as an SVG data URL. */
export function signatureDataUrl(name: string, rng: Rng): string {
  let x = 12;
  const baseline = 42;
  let d = `M ${x} ${baseline}`;
  const strokes = Math.min(10, Math.max(5, name.length));
  for (let i = 0; i < strokes; i += 1) {
    const nx = x + rng.int(14, 26);
    const cy = baseline - rng.int(10, 30);
    const ny = baseline + rng.int(-6, 6);
    d += ` Q ${x + (nx - x) / 2} ${cy} ${nx} ${ny}`;
    x = nx;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${x + 16}" height="60" viewBox="0 0 ${x + 16} 60"><path d="${d}" fill="none" stroke="#0F1F20" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="52" x2="${x + 8}" y2="52" stroke="#94A3B8" stroke-width="0.6"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

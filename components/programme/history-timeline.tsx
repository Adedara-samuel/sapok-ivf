import { formatDate } from "@/lib/utils/dates";

export function HistoryTimeline({ items }: { items: { at: string; label: string }[] }) {
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <ol className="relative ml-2 border-l pl-4">
      {sorted.map((h, i) => (
        <li key={`${h.at}-${i}`} className="mb-3 last:mb-0">
          <span
            className="bg-primary ring-background absolute -left-1.5 mt-1.5 size-3 rounded-full ring-4"
            aria-hidden="true"
          />
          <p className="text-sm">{h.label}</p>
          <p className="text-muted-foreground text-xs">{formatDate(h.at)}</p>
        </li>
      ))}
    </ol>
  );
}

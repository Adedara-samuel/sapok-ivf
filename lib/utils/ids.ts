let counter = 0;

/** Runtime-unique id with a readable prefix (e.g. "ORD-lq3k9a2"). */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1296;
  const time = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 46656)
    .toString(36)
    .padStart(3, "0");
  return `${prefix}-${time}${counter.toString(36).padStart(2, "0")}${rand}`;
}

export function pad(value: number, width: number): string {
  return value.toString().padStart(width, "0");
}

/** Next sequential code given existing codes like PRN-BR01-000123. */
export function nextSequence(existing: readonly string[], prefix: string, width: number): string {
  const max = existing.reduce((acc, code) => {
    if (!code.startsWith(prefix)) return acc;
    const n = Number.parseInt(code.slice(prefix.length), 10);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `${prefix}${pad(max + 1, width)}`;
}

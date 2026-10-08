const QUALITY: Record<string, number> = { A: 3, B: 2, C: 1 };

/** Numeric quality score so embryos sort best-first (Gardner blastocyst > cleavage grade). */
export function gradeScore(grade: string | undefined): number {
  if (!grade) return 0;
  const blast = /^(\d)([ABC])([ABC])$/.exec(grade.trim());
  if (blast) {
    return 100 + Number(blast[1]) * 10 + (QUALITY[blast[2] ?? "C"] ?? 1) * 3 + (QUALITY[blast[3] ?? "C"] ?? 1);
  }
  const cleavage = /^(\d+)-cell G(\d)/.exec(grade.trim());
  if (cleavage) return Number(cleavage[1]) * 2 + (4 - Number(cleavage[2]));
  return 1;
}

export function isBlastocystGrade(grade: string | undefined): boolean {
  return Boolean(grade && /^\d[ABC][ABC]$/.test(grade.trim()));
}

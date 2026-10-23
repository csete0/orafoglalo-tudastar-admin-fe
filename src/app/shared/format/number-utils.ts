/** Dollár-összeg az AI-költés pult formájában ($0.012 / $1.25). */
export function formatUsd(v: number): string {
  return '$' + v.toFixed(v < 1 ? 3 : 2);
}

/** Arány (0–1), ha van nevező; különben null. */
export function ratio(part: number | null, whole: number): number | null {
  return part === null || whole === 0 ? null : part / whole;
}

/** Százalék (0–100); nulla nevezőnél 0. */
export function percentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100;
}

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

/** Bájt → olvasható méret mértékegységgel: 512 B, 1.5 KB, 2.0 MB. */
export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
}

/** Bájt → MB egy tizedessel, mértékegység nélkül (a „MB” felirat a sablonban van). */
export function formatMb(bytes: number): string {
  return (bytes / BYTES_PER_MB).toFixed(1);
}

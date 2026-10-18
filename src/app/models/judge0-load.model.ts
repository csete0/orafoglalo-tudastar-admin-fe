/** Admin „Kódfuttató terhelés” (GET judge0-load?days=): a Judge0 óránkénti terhelés-statisztikája. */
export type Judge0LoadStatus = 'none' | 'green' | 'yellow' | 'red';

export interface Judge0LoadStats {
  runs: number;
  busy: number;
  timeouts: number;
  systemErrors: number;
  /** A busy-elutasítás nélküli futások (ezekből jön a p50/p95). */
  completed: number;
  p50Ms: number | null;
  p95Ms: number | null;
  avgMs: number | null;
  maxMs: number;
  avgWaitMs: number | null;
  maxWaitMs: number;
  maxQueueDepth: number;
  histogram: number[];
}

export interface Judge0LoadDaily {
  date: string;
  kind: string;
  stats: Judge0LoadStats;
  /** Munkaidős p95 (null, ha kevés a futás). */
  workHoursP95Ms: number | null;
}

export interface Judge0LoadHourly {
  /** Magyar helyi idő, az óra eleje (pl. „2026-10-18T09:00:00”). */
  hour: string;
  kind: string;
  stats: Judge0LoadStats;
}

export interface Judge0LoadThresholds {
  workHourStart: number;
  workHourEnd: number;
  yellowP95Ms: number;
  redP95Ms: number;
  redBusyRatio: number;
  minRunsForP95: number;
}

export interface Judge0LoadReport {
  days: number;
  status: Judge0LoadStatus;
  recommendation: string;
  reasons: string[];
  thresholds: Judge0LoadThresholds;
  daily: Judge0LoadDaily[];
  hourly: Judge0LoadHourly[];
}

export const JUDGE0_KINDS: { key: string; label: string; color: string }[] = [
  { key: 'run', label: 'Futtatás', color: 'var(--series-chat)' },
  { key: 'project', label: 'Projektműhely', color: 'var(--series-project-hint)' },
  { key: 'grading', label: 'Pontozás', color: 'var(--series-grading)' },
  { key: 'contest', label: 'Verseny', color: 'var(--series-mock-exam)' },
  { key: 'aspnet', label: 'ASP.NET', color: 'var(--series-teacher-ai-code-task)' },
];

export const JUDGE0_STATUS_LABELS: Record<Judge0LoadStatus, string> = {
  none: 'Nincs adat',
  green: 'Rendben',
  yellow: 'Figyelni kell',
  red: 'Túlterhelt',
};

/** Állapot-jelvény Tailwind-osztályai. */
export const JUDGE0_STATUS_CLASSES: Record<Judge0LoadStatus, string> = {
  none: 'bg-bg-elevated text-text-muted',
  green: 'bg-success-subtle text-success',
  yellow: 'bg-warning-subtle text-warning',
  red: 'bg-danger-subtle text-danger',
};

export function judge0KindLabel(kind: string): string {
  return JUDGE0_KINDS.find((k) => k.key === kind)?.label ?? kind;
}

/** Ezredmásodperc másodpercben („0,8 s”), null → „–”. */
export function fmtMs(ms: number | null): string {
  return ms === null ? '–' : `${(ms / 1000).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} s`;
}

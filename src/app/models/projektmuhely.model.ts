/** Az admin Projektműhely-oldal DTO-i (a BE ProjectAdminDtos tükrei). */

export const RUNTIME_LABELS: Record<string, string> = {
  'browser-python': 'Python',
  'browser-js': 'JavaScript',
  'judge0-csharp': 'C#',
  'judge0-java': 'Java',
  'judge0-aspnet': 'C# (ASP.NET Core)',
};

export interface ProjectAdminProjectRow {
  slug: string;
  title: string;
  isPublished: boolean;
  milestoneCount: number;
  started: number;
  completed: number;
  active7: number;
  active30: number;
  byRuntime: Record<string, number>;
}

export interface ProjectAdminDay {
  date: string;
  checks: number;
  previews: number;
  aiRequests: number;
  aiCostUsd: number;
}

export interface ProjectAdminOverview {
  days: number;
  projects: ProjectAdminProjectRow[];
  daily: ProjectAdminDay[];
}

export interface ProjectAdminMilestoneRow {
  orderNo: number;
  title: string;
  kind: string;
  reached: number;
  passed: number;
  avgChecks: number;
  hint1: number;
  hint2: number;
  hint3: number;
  medianMinutesToPass: number | null;
}

export interface ProjectAdminFunnel {
  slug: string;
  title: string;
  started: number;
  milestones: ProjectAdminMilestoneRow[];
}

export interface ProjectAdminSourceCost {
  source: string;
  requests: number;
  costUsd: number;
}

export interface ProjectAdminProjectCost {
  slug: string;
  title: string;
  aiRequests: number;
  aiCostUsd: number;
  checks: number;
  previews: number;
  judge0CpuSeconds: number;
  activeStudents: number;
  aiCostPerActiveStudentUsd: number;
}

export interface ProjectAdminCosts {
  days: number;
  totalAiUsd: number;
  unattributedAiUsd: number;
  checks: number;
  previews: number;
  judge0CpuSeconds: number;
  bySource: ProjectAdminSourceCost[];
  byProject: ProjectAdminProjectCost[];
}

export interface ProjectAdminUserProject {
  slug: string;
  title: string;
  runtime: string;
  currentMilestoneOrder: number;
  milestoneCount: number;
  passedCount: number;
  checks: number;
  hint1: number;
  hint2: number;
  hint3: number;
  aiCostUsd30: number;
  startedAt: string;
  completedAt: string | null;
  lastActivityAt: string | null;
}

/** Technikum: részenkénti átlag és bukási arány (BE: ProjectAdminStatsService.GetTechnikumStatsAsync). */
export interface ProjectAdminTechnikumPartStat {
  results: number;
  students: number;
  /** Átlagos pontarány %-ban; null, ha nincs eredmény. */
  avgPercent: number | null;
  /** A 40% alatti eredmények aránya %-ban; null, ha nincs eredmény. */
  failRatePercent: number | null;
}

export interface ProjectAdminTechnikumPart {
  partKey: string;
  maxPoints: number;
  /** Vizsga-munkamenet (önálló próba vagy dolgozat). */
  exam: ProjectAdminTechnikumPartStat;
  /** Gyakorló ellenőrzés. */
  practice: ProjectAdminTechnikumPartStat;
}

export interface ProjectAdminTechnikumProject {
  slug: string;
  title: string;
  kind: 'exam' | 'practice';
  isPublished: boolean;
  parts: ProjectAdminTechnikumPart[];
}

export interface ProjectAdminTechnikumStats {
  days: number;
  projects: ProjectAdminTechnikumProject[];
}

/** A vizsgarészek neve (a diák- és tanári app felirataival egyezően). */
export const EXAM_PART_LABELS: Record<string, string> = {
  console: 'Konzolos alkalmazás',
  gui: 'Grafikus alkalmazás',
  web: 'Weboldal (frontend)',
  api: 'Backend (REST API)',
  client: 'Kliens alkalmazás',
};

/** Az admin Projektműhely-oldal DTO-i (a BE ProjectAdminDtos tükrei). */

export const RUNTIME_LABELS: Record<string, string> = {
  'browser-python': 'Python',
  'browser-js': 'JavaScript',
  'judge0-csharp': 'C#',
  'judge0-java': 'Java',
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

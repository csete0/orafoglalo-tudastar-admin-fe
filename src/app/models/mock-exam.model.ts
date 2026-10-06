// Próbaérettségi - admin (PATRICKS-PROBAERETTSEGI-TERV.md F); lásd DigitalCulture.Domain.Entities.MockExams.MockExamDtos.

/** Az időpontok UTC-ben jönnek; az űrlap budapesti helyi idővel küld (a szerver alakítja UTC-re). */
export interface AdminMockExam {
  id: number;
  slug: string;
  title: string;
  registrationOpensAt: string;
  opensAt: string;
  startClosesAt: string;
  resultsPlannedAt: string;
  resultsPublishedAt: string | null;
  practiceReleaseAt: string;
  releasedAsPracticeAt: string | null;
  kozepTaskSetId: number;
  emeltTaskSetId: number;
  kozepTimeLimitSeconds: number;
  emeltTimeLimitSeconds: number;
  totalBudgetUsd: number;
  badgeKeyPrefix: string | null;
  isPublished: boolean;
  hasSessions: boolean;
  registrations: number;
}

export interface AdminMockExamUpsert {
  slug: string;
  title: string;
  /** Budapesti helyi idő, „yyyy-MM-ddTHH:mm”. */
  registrationOpensAt: string;
  opensAt: string;
  startClosesAt: string;
  resultsPlannedAt: string;
  practiceReleaseAt: string;
  kozepTaskSetId: number;
  emeltTaskSetId: number;
  kozepTimeLimitSeconds: number;
  emeltTimeLimitSeconds: number;
  totalBudgetUsd: number;
  badgeKeyPrefix: string | null;
}

export interface AdminMockExamTaskSetOption { id: number; title: string; level: string | null; }

export interface AdminMockExamSourceRow {
  source: string;
  registered: number;
  started: number;
  submitted: number;
  payers7: number;
  payers30: number;
  revenue30: number;
}

export interface AdminMockExamMarketing {
  newAccountsFromEvent: number;
  newAccountsViaTeacher: number;
  participants: number;
  payers7: number;
  payers30: number;
  revenue7: number;
  revenue30: number;
  aiCostUsd: number;
  revenueToAiCostRatio: number | null;
  roiAvailable: boolean;
  bySource: AdminMockExamSourceRow[];
}

export interface AdminMockExamStatus {
  event: AdminMockExam;
  registrations: { kozep: number; emelt: number; teacherSourced: number; groups: number };
  started: number;
  inProgress: number;
  submitted: number;
  abandoned: number;
  graded: number;
  pendingGrading: number;
  gradingErrors: { sessionId: number; taskTitle: string; error: string | null }[];
  costTodayUsd: number;
  costTotalUsd: number;
  totalBudgetUsd: number;
  budgetUsedPercent: number;
  budgetAlerts: { at50: string | null; at80: string | null; exhausted: string | null };
  queuedForAi: { count: number; oldestSubmittedAt: string | null };
  neededToClearQueueUsd: number;
  projectedTotalUsd: number;
  /** A Hangfire „grading” sor hossza; -1, ha nem olvasható. */
  queueLength: number;
  dailyStarts: number[];
  dailySubmits: number[];
  dailyPercentHistogram: number[][];
  badgesAwarded: { participant: number; silver: number; gold: number };
  marketing: AdminMockExamMarketing;
}

const BUDAPEST = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});

/** Az admin-API zóna nélkül szerializálja a (UTC) időpontokat - mindkét alakot UTC-ként olvassuk. */
export function asUtc(iso: string): Date {
  return new Date(/([zZ]|[+-]\d\d:\d\d)$/.test(iso) ? iso : `${iso}Z`);
}

/** UTC → „yyyy-MM-ddTHH:mm” budapesti helyi idő (a datetime-local mezőhöz). */
export function toBudapestInput(utcIso: string): string {
  return BUDAPEST.format(asUtc(utcIso)).replace(' ', 'T');
}

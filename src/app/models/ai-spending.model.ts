/** AI-KOLTES-PULT: a backend AiRequestLog/QuizQuestionMaintenanceRun DTO-inak tükrei. */

export const AI_SOURCES = [
  { key: 'chat', label: 'AI Mentor (diák chat)', color: 'var(--series-chat)' },
  { key: 'grading', label: 'Vizsga AI-értékelés', color: 'var(--series-grading)' },
  { key: 'classtest', label: 'Dolgozat AI-pontozás (tanári)', color: 'var(--series-classtest)' },
  { key: 'error', label: 'Hiba keresése', color: 'var(--series-error)' },
  { key: 'studyplan', label: 'Tanulási terv (automata)', color: 'var(--series-studyplan)' },
  { key: 'quizgen', label: 'Kvíz-generálás (tanári)', color: 'var(--series-quizgen)' },
  { key: 'maint', label: 'Kvíz-karbantartás', color: 'var(--series-maint)' },
  { key: 'dailychallenge', label: 'Napi kihívás (automata)', color: 'var(--series-dailychallenge)' },
  { key: 'project-hint', label: 'Projektműhely: AI-segítség', color: 'var(--series-project-hint)' },
  { key: 'project-review', label: 'Projektműhely: kódvéleményezés', color: 'var(--series-project-review)' },
  { key: 'project-error', label: 'Projektműhely: hibamagyarázat', color: 'var(--series-project-error)' },
  { key: 'office-grading', label: 'Irodai feladat értékelése (gyakorlás)', color: 'var(--series-office-grading)' },
  { key: 'exam-full', label: 'Teljes vizsga értékelése', color: 'var(--series-exam-full)' },
  { key: 'mock-exam', label: 'Próbaérettségi', color: 'var(--series-mock-exam)' },
  { key: 'code-practice', label: 'Kód/SQL feladat értékelése (gyakorlás)', color: 'var(--series-code-practice)' },
  { key: 'exam-rubric-draft', label: 'Tanári szempontlista-vázlat', color: 'var(--series-exam-rubric-draft)' },
  { key: 'teacher-sql-schema', label: 'Tanár: SQL-fájl generálás', color: 'var(--series-teacher-sql-schema)' },
  { key: 'teacher-sql-queries', label: 'Tanár: SQL megoldó lekérdezések', color: 'var(--series-teacher-sql-queries)' },
  { key: 'teacher-ai-code-task', label: 'Tanár: AI programozási feladat', color: 'var(--series-teacher-ai-code-task)' },
  { key: 'teacher-quiz-source', label: 'Tanár: kvíz szövegből', color: 'var(--series-teacher-quiz-source)' },
  { key: 'teacher-test-feedback', label: 'Tanár: dolgozat-visszajelzés', color: 'var(--series-teacher-test-feedback)' },
  { key: 'teacher-code-comments', label: 'Tanár: kód-megjegyzés javaslat', color: 'var(--series-teacher-code-comments)' },
  { key: 'team-repo-review', label: 'Csapat: MI-repóátnézés', color: 'var(--series-team-repo-review)' },
  { key: 'teacher-office-task', label: 'Tanár: irodai feladat megoldásból', color: 'var(--series-teacher-office-task)' },
  { key: 'oral-exam-voice', label: 'Szóbeli vizsga: hang (OpenAI)', color: 'var(--series-oral-exam-voice)' },
  { key: 'oral-exam-grading', label: 'Szóbeli vizsga: értékelés', color: 'var(--series-oral-exam-grading)' },
] as const;

export type AiSourceKey = (typeof AI_SOURCES)[number]['key'];

export function sourceLabel(key: string): string {
  return AI_SOURCES.find((s) => s.key === key)?.label ?? key;
}

export function sourceColor(key: string): string {
  return AI_SOURCES.find((s) => s.key === key)?.color ?? 'var(--color-text-muted)';
}

export interface AiSpendingDayDto {
  date: string;
  bySource: Record<string, number>;
}

export interface AiSpendingSourceTotalDto {
  source: string;
  totalUsd: number;
}

export interface AiSpendingOverviewDto {
  dailyBySource: AiSpendingDayDto[];
  monthTotalsBySource: AiSpendingSourceTotalDto[];
  todayTotalUsd: number;
  monthTotalUsd: number;
  myOwnMonthUsd: number;
  automationMonthUsd: number;
}

/** Az OpenRouter fiók TELJES (nem forrásonkénti) fennmaradó kredit-egyenlege. */
export interface OpenRouterCreditsDto {
  totalCredits: number;
  totalUsage: number;
  remainingCredits: number;
}

export interface AiSpendingTopSpenderDto {
  userId: number;
  userName: string;
  requestCount: number;
  totalUsd: number;
}

/** Egy tanár e havi dolgozat AI-pontozásai a havi darabkerethez mérve (a költést a rendszer állja). */
/** Teljes vizsga (I): e havi értékelések, irodai MI-költés a napi riasztással, a feltöltések tárhelye (BE: AiSpendingFullExamUsageDto). */
export interface AiSpendingFullExamUsageDto {
  gradedExamsThisMonth: number;
  studentsThisMonth: number;
  examCostTodayUsd: number;
  practiceCostTodayUsd: number;
  last30DaysCostUsd: number;
  dailyAlertUsd: number;
  dailyAlert: boolean;
  storageBytes: number;
  storageFiles: number;
  storageLast30DaysBytes: number;
}

export interface AiSpendingClassTestTeacherDto {
  teacherUserId: number;
  teacherName: string;
  email: string;
  institutionName: string | null;
  gradedThisMonth: number;
  monthlyLimit: number;
}

/** Havi riport (GET ai-spending/monthly-report): egy ember havi AI-költése forrásonként. */
export interface MonthlyReportPersonDto {
  userId: number;
  name: string;
  email: string;
  totalUsd: number;
  requestCount: number;
  bySource: Record<string, number>;
}

export interface MonthlyReportInstitutionDto {
  schoolId: number;
  schoolName: string;
  totalUsd: number;
  requestCount: number;
  teachers: MonthlyReportPersonDto[];
  students: MonthlyReportPersonDto[];
}

/** Rendszer-hívások, amelyek senkihez nem köthetők (pl. kvíz-karbantartás). */
export interface MonthlyReportUnattributedDto {
  source: string;
  totalUsd: number;
  requestCount: number;
}

export interface AiSpendingMonthlyReportDto {
  month: string;
  totalUsd: number;
  requestCount: number;
  attributedUsd: number;
  unattributedUsd: number;
  institutions: MonthlyReportInstitutionDto[];
  individualStudents: MonthlyReportPersonDto[];
  individualTeachers: MonthlyReportPersonDto[];
  otherUsers: MonthlyReportPersonDto[];
  unattributed: MonthlyReportUnattributedDto[];
}

export interface AiRequestLogDto {
  id: number;
  createdAt: string;
  userId: number;
  userName: string;
  source: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number | null;
}

export interface AiRequestLogPageDto {
  items: AiRequestLogDto[];
  totalCount: number;
}

export interface AiRequestLogFilter {
  source?: string;
  userQuery?: string;
  fromDate?: string;
  toDate?: string;
}

export interface QuizMaintenanceEstimateRequest {
  rangeStartId?: number | null;
  rangeEndId?: number | null;
  model: string;
}

export interface QuizMaintenanceEstimateDto {
  candidateCount: number;
  estimatedCostUsd: number;
}

export interface QuizMaintenanceRunRequest {
  rangeStartId?: number | null;
  rangeEndId?: number | null;
  model?: string | null;
  dryRun: boolean;
}

export interface QuizMaintenanceRunStartedDto {
  runId: string;
  candidatesReviewed: number;
  dryRun: boolean;
}

export interface QuizMaintenanceRunDto {
  id: string;
  startedAt: string;
  completedAt: string | null;
  triggeredByUserId: number | null;
  triggeredByName: string | null;
  rangeStartId: number | null;
  rangeEndId: number | null;
  model: string;
  dryRun: boolean;
  candidatesReviewed: number;
  estimatedCostUsd: number | null;
  errorMessage: string | null;
}

export interface QuizMaintenanceRunPageDto {
  items: QuizMaintenanceRunDto[];
  totalCount: number;
}

export const MAINTENANCE_ACTION_LABELS: Record<string, string> = {
  Fixed: 'Javítva',
  Deactivated: 'Inaktiválva',
  FlaggedForTeacher: 'Tanárnak jelölve',
  ReplacementAdded: 'Helyettesítő hozzáadva',
  NoAction: 'Nincs teendő',
};

export const MAINTENANCE_ACTION_BADGES: Record<string, string> = {
  Fixed: 'badge-success',
  Deactivated: 'badge-danger',
  FlaggedForTeacher: 'badge-warning',
  ReplacementAdded: 'badge-primary',
  NoAction: 'badge-neutral',
};

export interface QuizMaintenanceDecisionDto {
  questionId: number;
  action: string;
  oldQuestionText: string | null;
  newQuestionText: string | null;
  oldCorrectAnswer: string | null;
  newCorrectAnswer: string | null;
  reasoning: string | null;
  isTeacherOwned: boolean;
  teacherName: string | null;
}

export interface QuizMaintenanceMergeRequest {
  keepQuestionId: number;
  duplicateQuestionId: number;
}

export interface QuizMaintenanceMergeResultDto {
  teacherNotified: boolean;
}

export interface AutomationStatusDto {
  key: string;
  lastRunAt: string | null;
  lastRunCostUsd: number | null;
  scheduleDescription: string;
}

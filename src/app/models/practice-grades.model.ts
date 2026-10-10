/**
 * Gyakorló értékelések admin-nézete (PATRICKS-GYAKORLO-ERTEKELES-TERV.md, 6b fázis).
 * BE: Admin.API `api/admin/practice-grades` - csak a gyakorló sorok (ExamTaskAttemptId IS NULL), a költség az
 * AiRequestLogs-ból (`code-practice` és `office-grading` gyakorló része).
 */

/** Értékelés-típus: kód (Python stb.), SQL, irodai/weblapos fájl. */
export type PracticeGradeKind = 'code' | 'sql' | 'files';

/** Csomag (a TokenLimitService szintje szerint; az intézményi hely külön). */
export type PracticeGradeTier = 'free' | 'standard' | 'premium' | 'institutional';

export const PRACTICE_KIND_LABELS: Record<string, string> = {
  code: 'Kód',
  sql: 'SQL',
  files: 'Irodai / weblap',
};

export const PRACTICE_TIER_LABELS: Record<string, string> = {
  free: 'Ingyenes',
  standard: 'Standard',
  premium: 'Prémium',
  institutional: 'Intézményi',
  unknown: 'Ismeretlen (régi sor)',
};

/** Darab és költség egy időszakra. */
export interface PracticeGradeCount {
  count: number;
  costUsd: number;
}

/** Egy típus vagy csomag sora: mai és havi (naptári hónap, magyar idő) darab + költség. */
export interface PracticeGradeBucket {
  key: string;
  today: PracticeGradeCount;
  month: PracticeGradeCount;
}

export interface PracticeGradeDay {
  /** yyyy-MM-dd (magyar nap). */
  date: string;
  count: number;
  failed: number;
  costUsd: number;
}

/** Keret-kihasználtság csomagonként és típusonként: hány diák érte el a plafont. */
export interface PracticeGradeQuotaUsage {
  kind: string;
  tier: string;
  dailyLimit: number;
  /** null: ennek a típusnak nincs havi kerete (irodai). */
  monthlyLimit: number | null;
  /** Hány diák kért ma / ebben a hónapban legalább egyet. */
  activeToday: number;
  activeThisMonth: number;
  /** Hány diák érte el ma a napi, illetve ebben a hónapban a havi plafont. */
  atDailyLimitToday: number;
  atMonthlyLimit: number;
}

/** Toplista a legtöbbet kérő fiókokról (visszaélés-figyelés). */
export interface PracticeGradeTopUser {
  userId: number;
  email: string;
  name: string | null;
  tier: string;
  count: number;
  failed: number;
  costUsd: number;
  lastAt: string;
}

export interface PracticeGradeOverview {
  /** A napi sor és a toplista ablaka napokban. */
  days: number;
  totalCount: number;
  failedCount: number;
  totalCostUsd: number;
  byKind: PracticeGradeBucket[];
  byTier: PracticeGradeBucket[];
  daily: PracticeGradeDay[];
  quota: PracticeGradeQuotaUsage[];
  topUsers: PracticeGradeTopUser[];
}

/** Egy diák keretének állása típusonként (a mai jóváírással együtt). */
export interface PracticeGradeUserQuota {
  kind: string;
  usedToday: number;
  dailyLimit: number;
  usedThisMonth: number;
  monthlyLimit: number | null;
  /** A mára adott kézi jóváírás (a dailyLimit már tartalmazza). */
  creditToday: number;
}

export interface PracticeGradeUserRow {
  id: number;
  createdAt: string;
  kind: string;
  taskId: number;
  taskTitle: string;
  taskSetTitle: string;
  /** pending | ok | failed */
  status: string;
  points: number | null;
  max: number | null;
  costUsd: number | null;
}

export interface PracticeGradeUserCredit {
  createdAt: string;
  kind: string;
  amount: number;
  reason: string;
  adminEmail: string;
}

export interface PracticeGradeUserDetail {
  tier: string;
  quotas: PracticeGradeUserQuota[];
  /** Az utolsó 50 gyakorló értékelés, legújabb elöl. */
  grades: PracticeGradeUserRow[];
  /** A kézi jóváírások (audit-naplóba is kerülnek). Opcionális. */
  credits?: PracticeGradeUserCredit[];
}

/** Kézi keret-jóváírás (support): a mai napi és az aktuális havi keretet is ennyivel emeli. */
export interface PracticeGradeCreditRequest {
  kind: string;
  amount: number;
  reason: string;
}

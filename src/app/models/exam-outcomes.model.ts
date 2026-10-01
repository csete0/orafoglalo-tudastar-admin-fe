/** Érettségi-eredmények (BE: DigitalCulture.Domain/Entities/ExamOutcomes/ExamOutcomeAdminDtos.cs). */

export interface ExamOutcomeSegment {
  label: string;
  count: number;
  averagePercent: number | null;
}

export interface ExamOutcomeLevelStats {
  level: 'kozep' | 'emelt';
  count: number;
  averagePercent: number | null;
  /** A jegyek eloszlása 1-től 5-ig. */
  grades: number[];
  segments: ExamOutcomeSegment[];
}

export interface ExamOutcomeSummary {
  year: number;
  years: number[];
  responses: number;
  notTaken: number;
  fromParents: number;
  usable: number;
  pendingQuotes: number;
  levels: ExamOutcomeLevelStats[];
  accuracy: { count: number; meanAbsoluteError: number | null; withinBandShare: number | null; meanSignedError: number | null };
}

export interface ExamOutcomeQuote {
  id: number;
  year: number;
  level: string | null;
  percent: number | null;
  grade: number | null;
  quote: string;
  status: 'pending' | 'approved' | 'rejected';
  updatedAt: string;
}

/** Ennyi eredmény alatt az átlag nem mutatható nyilvánosan (a terv 1.7 pontja). */
export const PUBLIC_MIN_COUNT = 20;

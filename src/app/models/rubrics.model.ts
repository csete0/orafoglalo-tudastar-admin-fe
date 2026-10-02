/** Szempontlisták (BE: DigitalCulture.Domain/Entities/Rubrics/TaskRubric.cs). */

export type RubricStatus = 'draft' | 'approved' | 'superseded' | 'rejected';
export type RubricItemKind = 'criterion' | 'statement' | 'threshold';

export interface RubricTaskRow {
  taskId: number;
  setTitle: string;
  levelId: number;
  taskType: string;
  taskTitle: string;
  taskMaxPoints: number | null;
  rubricId: number | null;
  version: number | null;
  status: RubricStatus | null;
  itemCount: number;
  hasApproved: boolean;
}

export interface RubricItem {
  id: number;
  order: number;
  section: string | null;
  text: string;
  kind: RubricItemKind;
  points: number;
  groupNo: number | null;
  minCorrect: number | null;
  checkMode: string | null;
}

export interface RubricDetail {
  id: number;
  taskId: number;
  setTitle: string;
  levelId: number;
  taskType: string;
  taskTitle: string;
  taskMaxPoints: number | null;
  version: number;
  status: RubricStatus;
  source: string;
  sourceRef: string | null;
  rawTotal: number;
  examPoints: number;
  note: string | null;
  reviewedAt: string | null;
  itemPointSum: number;
  /** A jóváhagyás akadályai (üres = jóváhagyható). */
  problems: string[];
  items: RubricItem[];
}

export const RUBRIC_STATUS_LABELS: Record<RubricStatus, string> = {
  draft: 'vázlat',
  approved: 'jóváhagyva',
  superseded: 'lecserélve',
  rejected: 'elutasítva',
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  word: 'Szövegszerkesztés', excel: 'Táblázatkezelés', ppt: 'Prezentáció', graphics: 'Grafika', web: 'Weblap',
  sql: 'Adatbázis', code: 'Programozás',
};

export const LEVEL_LABELS: Record<number, string> = { 2: 'közép', 3: 'emelt' };

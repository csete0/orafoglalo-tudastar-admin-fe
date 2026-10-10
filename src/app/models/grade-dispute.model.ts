/** Értékelési kifogás az admin-várólistán (BE: GradeDisputeAdminDto, PATRICKS-TELJES-VIZSGA-TERV.md, H4). */
export interface GradeDisputeItem {
  itemId: number;
  order: number;
  section: string | null;
  text: string;
  kind: 'criterion' | 'statement' | 'threshold';
  maxPoints: number;
  points: number;
  ok: boolean | null;
  reason: string | null;
  groupNo: number | null;
}

export interface GradeDisputeFile {
  id: string;
  name: string;
  sizeBytes: number;
}

export interface GradeDispute {
  id: number;
  createdAt: string;
  reason: string | null;
  studentName: string;
  studentEmail: string;
  taskId: number;
  taskTitle: string;
  taskSetTitle: string;
  examSessionId: number | null;
  /** Az értékelés fajtája (gyakorló kód-értékelés óta): 'files' (irodai/weblap) vagy 'code' (kód/SQL). Régi BE-nél hiányzik. */
  kind?: 'files' | 'code';
  rubricStatus: string | null;
  model: string | null;
  rawPoints: number | null;
  rawTotal: number | null;
  summary: string | null;
  items: GradeDisputeItem[];
  files: GradeDisputeFile[];
  resolvedAt: string | null;
  resolution: string | null;
  /** A diák által hibásnak jelölt tételek (M2). */
  disputedItemIds: number[];
}

/** Az admin javítása egy tételre (M2): szempontnál a helyes pont, állításnál a helyes igaz/hamis. */
export interface GradeItemCorrection {
  itemId: number;
  points: number | null;
  ok: boolean | null;
}

export interface GradeDisputeList {
  items: GradeDispute[];
  totalCount: number;
}

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
  rubricStatus: string | null;
  model: string | null;
  rawPoints: number | null;
  rawTotal: number | null;
  summary: string | null;
  items: GradeDisputeItem[];
  files: GradeDisputeFile[];
  resolvedAt: string | null;
  resolution: string | null;
}

export interface GradeDisputeList {
  items: GradeDispute[];
  totalCount: number;
}

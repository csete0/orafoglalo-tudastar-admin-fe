/** Vizsgaremek-csapat admin (BE: AdminTeamService.cs). */
export interface AdminTeamRow {
  id: number; name: string; kind: 'school' | 'individual'; status: 'proposed' | 'active' | 'rejected' | 'archived'; groupName: string | null; members: number;
  repoName: string | null; repoSizeKb: number | null; githubRepo: string | null; githubStatus: 'active' | 'broken' | 'unlinked' | null;
  lastSyncStatus: string | null; lastSyncAt: string | null; lastError: string | null; reviewsThisMonth: number; reviewCostUsd: number; createdAt: string;
}
export interface MirrorBranchState { action: string; ours: string | null; theirs: string | null; detail: string | null; at: string; }
export interface AdminTeamDetail {
  team: AdminTeamRow;
  members: { userId: number; email: string | null; name: string; role: string | null; joinedAt: string; leftAt: string | null }[];
  branches: Record<string, MirrorBranchState>;
}
export const SYNC_LABELS: Record<string, string> = {
  ok: 'rendben', diverged: 'eltért a GitHubon', error: 'hiba', workflow_blocked: 'workflow-fájl tiltva', importing: 'import fut', import_failed: 'import sikertelen',
};

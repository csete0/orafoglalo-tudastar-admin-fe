/** Git-admin (BE: GitAdminService.cs). */
export interface GitQuota {
  repoMaxMb: number;
  reposPerUser: number;
  fileMaxMb: number;
  pushesPerMinute: number;
  clonesPerMinute: number;
  snapshotMaxMb: number;
  updatedAt: string;
}

/** A kvóta-mentés kérése (a módosítás idejét a szerver állítja). */
export type GitQuotaUpdate = Omit<GitQuota, 'updatedAt'>;

export type GitRepoPurpose = 'project' | 'exercise' | 'gate';

export interface GitAdminRepo {
  id: number;
  name: string;
  ownerUserId: number;
  ownerEmail: string;
  purpose: GitRepoPurpose;
  projectSlug: string | null;
  sizeKb: number;
  lastPushAt: string | null;
  locked: boolean;
  lockReason: string | null;
  overQuota: boolean;
  createdAt: string;
}

export const GIT_PURPOSE_LABELS: Record<GitRepoPurpose, string> = { project: 'projekt', exercise: 'gyakorló', gate: 'kapu' };

/** Git-admin (BE: GitAdminService.cs). */
export interface GitQuota {
  repoMaxMb: number;
  reposPerUser: number;
  fileMaxMb: number;
  pushesPerMinute: number;
  clonesPerMinute: number;
  snapshotMaxMb: number;
  /** A vizsgaremek-csapat közös tárolójának mérete (MB, 1–500). */
  teamRepoMaxMb: number;
  updatedAt: string;
}

/** A kvóta-mentés kérése (a módosítás idejét a szerver állítja). */
export type GitQuotaUpdate = Omit<GitQuota, 'updatedAt'>;

export type GitRepoPurpose = 'project' | 'exercise' | 'gate' | 'team';

export interface GitAdminRepo {
  id: number;
  name: string;
  /** Csapattárolónál null (a tulaj a csapat: ownerTeamId). */
  ownerUserId: number | null;
  ownerEmail: string | null;
  ownerTeamId: number | null;
  purpose: GitRepoPurpose;
  projectSlug: string | null;
  sizeKb: number;
  lastPushAt: string | null;
  locked: boolean;
  lockReason: string | null;
  overQuota: boolean;
  createdAt: string;
}

/** Árva Forgejo-tároló (K6): a napi job jelölése (`deletesAfter`-kor törlődik, ha addig sem kerül gazdához) vagy már törölt. */
export interface GitOrphanRepo {
  id: number;
  name: string;
  status: 'marked' | 'deleted';
  firstSeenAt: string;
  lastSeenAt: string;
  deletedAt: string | null;
  deletesAfter: string;
}

export const GIT_PURPOSE_LABELS: Record<GitRepoPurpose, string> = { project: 'projekt', exercise: 'gyakorló', gate: 'kapu', team: 'csapat' };

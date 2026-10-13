/**
 * Verseny mód admin-listája (PATRICKS-VERSENY-MOD-TERV.md, 4.5).
 * BE: Admin.API `GET api/admin/contest/problems`. A kapu futtatása és a közzététel a fő API-n van (Task 9 szkript), itt csak megjelenítés.
 */

export type ContestGateStatus = 'none' | 'green' | 'red';

/** Csoportonkénti statisztika; a bukási arány 0–1 (a csoport legalább egy nem-AC tesztjét tartalmazó kész beküldések / kész beküldések). */
export interface ContestAdminGroupStat {
  label: string;
  points: number;
  attempts: number;
  failRate: number;
}

export interface ContestAdminProblem {
  slug: string;
  title: string;
  topicTitle: string;
  difficulty: number;
  isPublished: boolean;
  gateStatus: ContestGateStatus;
  gateCheckedAt: string | null;
  submissions30d: number;
  solvers: number;
  groups: ContestAdminGroupStat[];
}

export const CONTEST_GATE_LABELS: Record<ContestGateStatus, string> = { none: 'Nincs', green: 'Zöld', red: 'Piros' };

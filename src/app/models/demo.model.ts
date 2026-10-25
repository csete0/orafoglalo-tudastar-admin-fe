/** Demó-környezet (PATRICKS-DEMO-KORNYEZET-TERV.md F5) - a BE DemoEnvironmentDto tükre. */
export type DemoKind = 'owner' | 'school';
export type DemoStatus = 'active' | 'resetting' | 'deleting' | 'deleted' | 'failed';

export interface DemoAccount {
  key: string;
  role: 'teacher' | 'student';
  name: string;
  email: string;
}

export interface DemoEnvironment {
  id: number;
  kind: DemoKind;
  title: string;
  city: string | null;
  status: DemoStatus;
  statusChangedAt: string;
  createdAt: string;
  expiresAt: string | null;
  deletesAt: string | null;
  loginBlocked: boolean;
  lastResetAt: string | null;
  resetCount: number;
  lastError: string | null;
  studentCount: number;
  nightlyReset: boolean;
  aiSpentTodayUsd: number;
  aiSpentTotalUsd: number;
  aiBudgetDailyUsd: number;
  aiBudgetTotalUsd: number | null;
  aiPerUserDailyUsd: number;
  voiceSessionsTotal: number | null;
  voiceSessionsDaily: number | null;
  accounts: DemoAccount[];
}

/** Egyszer látszó belépési adat (létrehozás / új jelszavak - D3). */
export interface DemoCredential {
  key: string;
  role: 'teacher' | 'student';
  name: string;
  email: string;
  password: string;
}

export interface DemoCredentials {
  environment: DemoEnvironment;
  credentials: DemoCredential[];
  studentAppUrl: string;
  teacherAppUrl: string;
}

export interface CreateSchoolDemoRequest {
  title: string;
  city: string | null;
  days: number | null;
  expiresAt: string | null;
  studentCount: 4 | 5;
}

export interface CreateOwnerDemoRequest {
  emailBase: string;
}

export interface ExtendDemoRequest {
  days: number | null;
  expiresAt: string | null;
  aiBudgetTotalUsd: number | null;
}

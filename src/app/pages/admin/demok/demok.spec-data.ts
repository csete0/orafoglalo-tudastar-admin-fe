import { DemoCredentials, DemoEnvironment } from '../../../models/demo.model';

/** A Demók oldal tesztadatai. */
export function demoEnv(overrides: Partial<DemoEnvironment> = {}): DemoEnvironment {
  return {
    id: 1, kind: 'school', title: 'Teszt Gimnázium', city: 'Szeged', status: 'active', statusChangedAt: '2026-10-25T10:00:00',
    createdAt: '2026-10-25T10:00:00', expiresAt: '2026-11-08T10:00:00', deletesAt: '2026-11-11T10:00:00', loginBlocked: false,
    lastResetAt: '2026-10-25T10:01:00', resetCount: 0, lastError: null, studentCount: 5, nightlyReset: false, aiSpentTodayUsd: 0.12,
    aiSpentTotalUsd: 0.5, aiBudgetDailyUsd: 1, aiBudgetTotalUsd: 5, aiPerUserDailyUsd: 0.3, voiceSessionsTotal: 1, voiceSessionsDaily: null,
    accounts: [{ key: 'tanar', role: 'teacher', name: 'Varga Eszter', email: 'tanar.d1@demo.patricks.invalid' }],
    ...overrides,
  };
}

export const demoCredentials: DemoCredentials = {
  environment: demoEnv(),
  credentials: [
    { key: 'tanar', role: 'teacher', name: 'Varga Eszter', email: 'tanar.d1@demo.patricks.invalid', password: 'Alma-1234-korte' },
    { key: 'diak1', role: 'student', name: 'Vadász Zsófia', email: 'diak1.d1@demo.patricks.invalid', password: 'Eper-5678-szilva' },
  ],
  studentAppUrl: 'https://www.patricks.hu/login',
  teacherAppUrl: 'https://teachers.patricks.hu',
};

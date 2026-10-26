/** Növekedés-mérés (BE: Patricks.Domain/Entities/Analytics/GrowthDtos.cs). Tesztfiókok nélkül. */

export interface GrowthOverview {
  registrations30: number;
  /** A 8–37 napja regisztráltak közül hánynak volt munkája az első 7 napban (0–1). */
  activationRate: number | null;
  newPayers30: number;
  activePayers: number;
  cancellations30: number;
  cancellationRate30: number | null;
}

export interface GrowthCohort {
  weekStart: string;
  registered: number;
  activated: number | null;
  paid: number;
  /** null: az a hét még nem telt el. */
  retainedWeek1: number | null;
  retainedWeek4: number | null;
  retainedWeek8: number | null;
}

export interface GrowthCancellations {
  days: number;
  total: number;
  withReason: number;
  reasons: { key: string; label: string; count: number }[];
  recent: { createdAt: string; reason: string; comment: string }[];
}

/** Tulajdonosi irányítópult (BE: Patricks.Domain/Entities/Analytics/BusinessDtos.cs). Összegek forintban. */
export interface RevenueMonth {
  month: string;
  subscription: number;
  examPass: number;
  parentPurchase: number;
  /** Becslés: az ajándékkód-vásárlás összege nincs tárolva - a csomag mostani listaára (bérlet-ajándék csak darabként). */
  gift: number;
  giftCount: number;
  gross: number;
  refunds: number;
  net: number;
  paymentCount: number;
  refundCount: number;
}

export interface RevenueReport {
  months: RevenueMonth[];
  recurringMonthlyEstimate: number;
  recurringSubscriptions: number;
  activeExamPasses: number;
  licences: { activeLicences: number; seats: number; seatsInUse: number; amountsTracked: boolean };
}

export interface TrialFunnelCohort {
  weekStart: string;
  registered: number;
  trialStarted: number;
  trialEnded: number;
  trialPaid: number;
  paidWithoutTrial: number;
}

export interface TrialFunnel {
  cohorts: TrialFunnelCohort[];
  trialGrantsInPeriod: number;
}

export interface UnitEconomicsMonth {
  month: string;
  aiCostUsd: number;
  aiCostHuf: number;
  unknownCostCalls: number;
  activeUsers: number;
  payingUsers: number;
  netRevenue: number;
  aiCostPerActiveUserHuf: number | null;
  aiCostPerPayingUserHuf: number | null;
  revenuePerPayingUserHuf: number | null;
  marginRate: number | null;
}

export interface UnitEconomics {
  usdToHuf: number;
  months: UnitEconomicsMonth[];
  topDrivers: { source: string; costUsd: number; costHuf: number; requests: number; share: number }[];
}

export interface ReferralReport {
  created: number;
  created30: number;
  converted: number;
  inviteeRewards: number;
  referrerRewardMonths: number;
  referrerExtend: number;
  referrerCode: number;
  referrerCapped: number;
  referrerRefunded: number;
  pending: number;
  pendingOverdue: number;
  topInviters: { userId: number; email: string | null; invited: number; converted: number; rewardMonths: number; pending: number }[];
}

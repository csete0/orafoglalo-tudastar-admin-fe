/** Növekedés-mérés (BE: DigitalCulture.Domain/Entities/Analytics/GrowthDtos.cs). Tesztfiókok nélkül. */

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

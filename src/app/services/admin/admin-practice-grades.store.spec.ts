import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminPracticeGradesStore } from './admin-practice-grades.store';
import { AdminPracticeGradesService } from './admin-practice-grades.service';
import { PracticeGradeOverview } from '../../models/practice-grades.model';

const overview = (totalCount: number, failedCount: number): PracticeGradeOverview => ({
  days: 30, totalCount, failedCount, totalCostUsd: 0, byKind: [], byTier: [], daily: [], quota: [], topUsers: [],
});

describe('AdminPracticeGradesStore', () => {
  let svc: { getOverview: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    svc = { getOverview: vi.fn(() => of(overview(20, 3))) };
    TestBed.configureTestingModule({ providers: [AdminPracticeGradesStore, { provide: AdminPracticeGradesService, useValue: svc }] });
  });

  it('load a megadott ablakkal tölt, megjegyzi, és kiszámolja a Failed arányt', () => {
    const store = TestBed.inject(AdminPracticeGradesStore);
    store.load(7);
    expect(svc.getOverview).toHaveBeenCalledWith(7);
    expect(store.days()).toBe(7);
    expect(store.failedRate()).toBeCloseTo(0.15);
    expect(store.loading()).toBe(false);

    // Paraméter nélkül az utoljára választott ablak marad.
    store.load();
    expect(svc.getOverview).toHaveBeenLastCalledWith(7);
  });

  it('hiba esetén error-t állít, a loading leáll', () => {
    svc.getOverview.mockReturnValue(throwError(() => ({ error: { errorMessage: 'Hiba.' } })));
    const store = TestBed.inject(AdminPracticeGradesStore);
    store.load();
    expect(store.error()).toBe('Hiba.');
    expect(store.loading()).toBe(false);
    expect(store.failedRate()).toBeNull();
  });
});

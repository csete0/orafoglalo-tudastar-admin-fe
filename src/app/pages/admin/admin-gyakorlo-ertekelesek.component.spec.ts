import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminGyakorloErtekelesekComponent } from './admin-gyakorlo-ertekelesek.component';
import { AdminPracticeGradesService } from '../../services/admin/admin-practice-grades.service';
import { AdminPracticeGradesStore } from '../../services/admin/admin-practice-grades.store';
import { PracticeGradeOverview } from '../../models/practice-grades.model';

const overview = (overrides: Partial<PracticeGradeOverview> = {}): PracticeGradeOverview => ({
  days: 30,
  totalCount: 40,
  failedCount: 6,
  totalCostUsd: 0.42,
  byKind: [
    { key: 'code', today: { count: 3, costUsd: 0.024 }, month: { count: 25, costUsd: 0.2 } },
    { key: 'sql', today: { count: 1, costUsd: 0.008 }, month: { count: 5, costUsd: 0.04 } },
    { key: 'files', today: { count: 0, costUsd: 0 }, month: { count: 10, costUsd: 0.206 } },
  ],
  byTier: [
    { key: 'free', today: { count: 2, costUsd: 0.016 }, month: { count: 12, costUsd: 0.1 } },
    { key: 'premium', today: { count: 2, costUsd: 0.016 }, month: { count: 28, costUsd: 0.32 } },
  ],
  daily: [
    { date: '2026-10-09', count: 4, failed: 1, costUsd: 0.03 },
    { date: '2026-10-10', count: 8, failed: 0, costUsd: 0.06 },
  ],
  quota: [
    { kind: 'code', tier: 'free', dailyLimit: 2, monthlyLimit: 20, activeToday: 5, activeThisMonth: 9, atDailyLimitToday: 2, atMonthlyLimit: 0 },
    { kind: 'files', tier: 'free', dailyLimit: 3, monthlyLimit: null, activeToday: 1, activeThisMonth: 4, atDailyLimitToday: 1, atMonthlyLimit: 0 },
  ],
  topUsers: [
    { userId: 89, email: 'sok@example.com', name: 'Sok Kérő', tier: 'premium', count: 31, failed: 2, costUsd: 0.25, lastAt: '2026-10-10T18:00:00Z' },
  ],
  ...overrides,
});

/** Gyakorló értékelések admin-lap (PATRICKS-GYAKORLO-ERTEKELES-TERV.md, 6b). */
describe('AdminGyakorloErtekelesekComponent', () => {
  let svc: { getOverview: ReturnType<typeof vi.fn> };

  function render() {
    TestBed.configureTestingModule({
      imports: [AdminGyakorloErtekelesekComponent],
      providers: [provideRouter([]), AdminPracticeGradesStore, { provide: AdminPracticeGradesService, useValue: svc }],
    });
    const fixture = TestBed.createComponent(AdminGyakorloErtekelesekComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    svc = { getOverview: vi.fn(() => of(overview())) };
  });

  it('típusonként és csomagonként mutatja a mai és havi darabot és költséget', () => {
    const el: HTMLElement = render().nativeElement;
    expect(svc.getOverview).toHaveBeenCalledWith(30);

    const kindRows = el.querySelectorAll('[data-testid="practice-by-kind"] tbody tr');
    expect(kindRows.length).toBe(3);
    expect(kindRows[0].textContent).toContain('Kód');
    expect(kindRows[0].textContent).toContain('25');
    expect(kindRows[0].textContent).toContain('$0.200');
    expect(kindRows[2].textContent).toContain('Irodai / weblap');
    expect(el.querySelector('[data-testid="practice-by-tier"]')!.textContent).toContain('Prémium');
  });

  it('a Failed arányt a darabszámból számolja, és 10% fölött pirossal jelzi', () => {
    const el: HTMLElement = render().nativeElement;
    const failed = el.querySelector('[data-testid="practice-failed-rate"]')!;
    expect(failed.textContent).toContain('15%');
    expect(failed.classList).toContain('text-danger');
  });

  it('értékelés nélkül a Failed arány „–”, nem NaN', () => {
    svc.getOverview.mockReturnValue(of(overview({ totalCount: 0, failedCount: 0 })));
    const el: HTMLElement = render().nativeElement;
    const failed = el.querySelector('[data-testid="practice-failed-rate"]')!;
    expect(failed.textContent).toContain('–');
    expect(failed.textContent).not.toContain('NaN');
  });

  it('a keret-kihasználtság a plafont elérő diákokat mutatja; havi keret nélküli típusnál „–”', () => {
    const el: HTMLElement = render().nativeElement;
    const rows = el.querySelectorAll('[data-testid="practice-quota"] tbody tr');
    expect(rows[0].textContent).toContain('2 / 20');
    expect(rows[1].textContent).toContain('3 / –');
    // A KPI a típusok mai plafonon lévő diákjainak összege.
    expect(el.querySelector('[data-testid="practice-kpis"]')!.textContent).toContain('Plafonon ma (diák)3');
  });

  it('a toplista a felhasználó-részletre linkel, a napi bontás a legfrissebb nappal kezd', () => {
    const el: HTMLElement = render().nativeElement;
    const link = el.querySelector('[data-testid="practice-top"] a')!;
    expect(link.getAttribute('href')).toBe('/users/89');
    expect(link.textContent).toContain('Sok Kérő');
    expect(el.querySelector('[data-testid="practice-daily"] span')!.textContent).toContain('2026.10.10.');
  });

  it('az időszak-váltó az új napszámmal tölt újra', () => {
    const fixture = render();
    const el: HTMLElement = fixture.nativeElement;
    const btn = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === '7 nap')!;
    btn.click();
    expect(svc.getOverview).toHaveBeenLastCalledWith(7);
  });

  it('betöltési hibánál a hibaüzenet jelenik meg', () => {
    svc.getOverview.mockReturnValue(throwError(() => ({ error: { errorMessage: 'Nincs jogosultság.' } })));
    const el: HTMLElement = render().nativeElement;
    expect(el.textContent).toContain('Nincs jogosultság.');
  });
});

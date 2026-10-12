import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminVersenyComponent } from './admin-verseny.component';
import { AdminContestService } from '../../services/admin/admin-contest.service';
import { AdminContestStore } from '../../services/admin/admin-contest.store';
import { ContestAdminProblem } from '../../models/contest-admin.model';

const problems: ContestAdminProblem[] = [
  {
    slug: 'osszeg', title: 'Összeg', topicTitle: 'Alapok', difficulty: 1, isPublished: true, gateStatus: 'green',
    gateCheckedAt: '2026-10-12T08:00:00Z', submissions30d: 12, solvers: 5,
    groups: [{ label: 'kicsi', points: 40, attempts: 10, failRate: 0.2 }],
  },
  {
    slug: 'szakasz', title: 'Szakasz', topicTitle: 'Geometria', difficulty: 3, isPublished: false, gateStatus: 'red',
    gateCheckedAt: null, submissions30d: 0, solvers: 0,
    groups: [
      { label: 'kicsi', points: 40, attempts: 4, failRate: 0.25 },
      { label: 'nagy', points: 60, attempts: 4, failRate: 0.75 },
    ],
  },
];

/** Verseny mód admin-lista (PATRICKS-VERSENY-MOD-TERV.md, 4.5). */
describe('AdminVersenyComponent', () => {
  function render() {
    TestBed.configureTestingModule({
      imports: [AdminVersenyComponent],
      providers: [AdminContestStore, { provide: AdminContestService, useValue: { getProblems: vi.fn(() => of(problems)) } }],
    });
    const fixture = TestBed.createComponent(AdminVersenyComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('betöltés után két sort mutat, a piros kapu pirulája gate-red', () => {
    const el: HTMLElement = render().nativeElement;
    expect(el.querySelectorAll('[data-testid="contest-problems"] tbody tr[data-testid^="row-"]').length).toBe(2);
    expect(el.querySelector('[data-testid="row-szakasz"] [data-testid="gate-red"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="row-osszeg"] [data-testid="gate-green"]')).not.toBeNull();
    expect(el.querySelector('[data-testid^="groups-"]')).toBeNull();
  });

  it('a sor kinyitásakor a csoport-statisztika látszik, a 60 % fölötti bukás piros', () => {
    const fixture = render();
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('[data-testid="row-szakasz"]') as HTMLElement).click();
    fixture.detectChanges();

    const rates = Array.from(el.querySelectorAll('[data-testid="groups-szakasz"] [data-testid="fail-rate"]'));
    expect(rates.map((r) => r.textContent?.trim())).toEqual(['25%', '75%']);
    expect(rates.map((r) => r.classList.contains('text-danger'))).toEqual([false, true]);

    (el.querySelector('[data-testid="row-szakasz"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="groups-szakasz"]')).toBeNull();
  });
});

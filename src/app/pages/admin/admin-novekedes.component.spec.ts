import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminNovekedesComponent, ratio } from './admin-novekedes.component';
import { AdminGrowthService } from '../../services/admin/admin-growth.service';

describe('AdminNovekedesComponent (Növekedés)', () => {
  function setup() {
    const api = {
      getOverview: vi.fn(() => of({ registrations30: 42, activationRate: 0.5, newPayers30: 3, activePayers: 17, cancellations30: 2, cancellationRate30: 0.105 })),
      getCohorts: vi.fn((weeks: number) => of([
        { weekStart: '2026-09-28', registered: 10, activated: 6, paid: 1, retainedWeek1: null, retainedWeek4: null, retainedWeek8: null },
        { weekStart: '2026-08-03', registered: 4, activated: 2, paid: 1, retainedWeek1: 3, retainedWeek4: 2, retainedWeek8: weeks === 26 ? 1 : 0 },
      ])),
      getCancellations: vi.fn(() => of({ days: 90, total: 5, withReason: 3,
        reasons: [{ key: 'vizsga-utan', label: 'Túl vagyok az érettségin', count: 2 }, { key: 'draga', label: 'Túl drága', count: 1 }],
        recent: [{ createdAt: '2026-09-20T10:00:00', reason: 'Túl drága', comment: 'Nyáron nem kell' }] })),
    };
    TestBed.configureTestingModule({ imports: [AdminNovekedesComponent], providers: [{ provide: AdminGrowthService, useValue: api }] });
    const fixture = TestBed.createComponent(AdminNovekedesComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, api };
  }

  it('számkártyák, kohorsz-táblázat (a még el nem telt hét „–”), lemondási okok és megjegyzések', () => {
    const { el } = setup();
    expect(el.querySelector('[data-testid="growth-kpis"]')?.textContent).toContain('42');
    expect(el.querySelector('[data-testid="growth-kpis"]')?.textContent).toContain('50%');
    const rows = [...el.querySelectorAll('[data-testid="growth-cohorts"] tbody tr')].map((r) => r.textContent!.replace(/\s+/g, ' ').trim());
    expect(rows[0]).toContain('2026.09.28.');
    expect(rows[0]).toContain('6 (60%)');
    expect(rows[0].match(/–/g)?.length).toBe(3);
    expect(rows[1]).toContain('3 (75%)');
    expect(el.querySelector('[data-testid="growth-reasons"]')?.textContent).toContain('Túl vagyok az érettségin');
    expect(el.textContent).toContain('Nyáron nem kell');
  });

  it('hét-váltás újratölti a kohorszokat; az arány üres kohorsznál null', () => {
    const { fixture, el, api } = setup();
    [...el.querySelectorAll('button')].find((b) => b.textContent!.trim() === '26 hét')!.click();
    fixture.detectChanges();
    expect(api.getCohorts).toHaveBeenLastCalledWith(26);
    expect(ratio(3, 0)).toBeNull();
    expect(ratio(null, 4)).toBeNull();
  });
});

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminKodfuttatoTerhelesComponent } from './admin-kodfuttato-terheles.component';
import { AdminJudge0LoadService } from '../../services/admin/admin-judge0-load.service';
import { Judge0LoadReport, Judge0LoadStats, fmtMs } from '../../models/judge0-load.model';

const stats = (runs: number, p95Ms: number | null, extra: Partial<Judge0LoadStats> = {}): Judge0LoadStats => ({
  runs, busy: 0, timeouts: 0, systemErrors: 0, completed: runs, p50Ms: 1000, p95Ms, avgMs: 800, maxMs: 2500,
  avgWaitMs: 100, maxWaitMs: 900, maxQueueDepth: 6, histogram: [runs, 0, 0, 0, 0, 0, 0], ...extra,
});
const thresholds = { workHourStart: 7, workHourEnd: 20, yellowP95Ms: 2000, redP95Ms: 3000, redBusyRatio: 0.01, redSystemErrorRatio: 0.005, minRunsForP95: 20 };

const report: Judge0LoadReport = {
  days: 7, status: 'yellow', recommendation: 'Érdemes figyelni: csúcsidőben már lassul vagy telítődik a kódfuttató.',
  reasons: ['3 futtatás „túlterhelt” (503) választ kapott (0.5%).'], thresholds,
  daily: [
    { date: '2026-10-17', kind: 'run', stats: stats(40, 1000), workHoursP95Ms: 1000 },
    { date: '2026-10-18', kind: 'run', stats: stats(500, 3000, { busy: 3 }), workHoursP95Ms: 3000 },
    { date: '2026-10-18', kind: 'grading', stats: stats(20, 5000), workHoursP95Ms: 5000 },
  ],
  hourly: [
    { hour: '2026-10-17T10:00:00', kind: 'run', stats: stats(40, 1000) },
    { hour: '2026-10-18T09:00:00', kind: 'run', stats: stats(300, 3000, { busy: 3 }) },
    { hour: '2026-10-18T09:00:00', kind: 'grading', stats: stats(20, 5000) },
    { hour: '2026-10-18T14:00:00', kind: 'run', stats: stats(200, 2000) },
  ],
};

describe('AdminKodfuttatoTerhelesComponent', () => {
  async function setup(r: Judge0LoadReport = report) {
    const api = { getReport: vi.fn(() => of(r)) };
    TestBed.configureTestingModule({ imports: [AdminKodfuttatoTerhelesComponent], providers: [{ provide: AdminJudge0LoadService, useValue: api }] });
    const fixture = TestBed.createComponent(AdminKodfuttatoTerhelesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, api };
  }

  it('állapot-kártya a javaslattal és az okokkal, napi táblázat legfrissebb nappal elöl', async () => {
    const { el, c, api } = await setup();
    expect(api.getReport).toHaveBeenCalledWith(7);
    expect(el.textContent).toContain('Figyelni kell');
    expect(el.textContent).toContain('Érdemes figyelni');
    expect(el.textContent).toContain('túlterhelt” (503)');
    expect(c.dailyRows().map((d) => d.date)).toEqual(['2026-10-18', '2026-10-18', '2026-10-17']);
    expect(c.dailyBars().length).toBe(2);
    expect(c.dailyBars()[1].segments.length).toBe(2); // futtatás + pontozás halmozva
  });

  it('alapból a legutolsó nap óránként; másik napra váltható', async () => {
    const { c } = await setup();
    expect(c.selectedDay()).toBe('2026-10-18');
    expect(c.hourlyRows().length).toBe(3);
    expect(c.hourlyBars().length).toBe(24);
    expect(c.hourlyBars()[9].segments.length).toBe(2);
    c.selectedDay.set('2026-10-17');
    expect(c.hourlyRows().map((h) => h.hour)).toEqual(['2026-10-17T10:00:00']);
  });

  it('nincs adat: üres állapot, nincs diagram', async () => {
    const { el, c } = await setup({ ...report, status: 'none', recommendation: 'Még nincs mérési adat ebben az időszakban.', reasons: [], daily: [], hourly: [] });
    expect(el.textContent).toContain('Még nincs mérési adat');
    expect(el.querySelector('svg')).toBeNull();
    expect(c.selectedDay()).toBeNull();
  });

  it('időszakváltáskor újratölt; ms → másodperc', async () => {
    const { c, api } = await setup();
    await c.setDays(30);
    expect(api.getReport).toHaveBeenLastCalledWith(30);
    expect([fmtMs(null), fmtMs(1000), fmtMs(2500)]).toEqual(['–', '1 s', '2,5 s']);
  });
});

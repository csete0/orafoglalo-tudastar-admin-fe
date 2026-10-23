import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { AdminKodfuttatoTerhelesComponent } from './admin-kodfuttato-terheles.component';
import { AdminJudge0LoadService } from '../../services/admin/admin-judge0-load.service';
import { JUDGE0_KINDS, Judge0LoadReport, Judge0LoadStats, fmtMs, judge0KindLabel } from '../../models/judge0-load.model';
import { BarChartComponent } from '../../shared/bar-chart/bar-chart.component';

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

/**
 * ÁTMENETI összehasonlító teszt (WP-B2): az oldal régi, saját diagram-számítása (`dailyColumns`/`hourlyColumns` + `ticks()`/`bars()`)
 * szó szerint, hogy a közös `app-bar-chart` kimenete ugyanarra a jelentésre ugyanaz legyen.
 */
const OLD = { width: 860, height: 180, padLeft: 36, padRight: 8, padTop: 10, padBottom: 22 };
type OldColumn = { key: string; label: string; rows: { kind: string; stats: Judge0LoadStats }[] };
function oldDailyColumns(r: Judge0LoadReport): OldColumn[] {
  const byDate = new Map<string, OldColumn>();
  for (const d of r.daily) {
    const col = byDate.get(d.date) ?? { key: d.date, label: 'nap', rows: [] };
    col.rows.push(d);
    byDate.set(d.date, col);
  }
  return [...byDate.values()].sort((a, b) => a.key.localeCompare(b.key));
}
function oldHourlyColumns(r: Judge0LoadReport, day: string): OldColumn[] {
  const rows = r.hourly.filter((h) => h.hour.startsWith(day));
  return Array.from({ length: 24 }, (_, h) => {
    const hh = String(h).padStart(2, '0');
    return { key: hh, label: h % 3 === 0 ? hh : '', rows: rows.filter((x) => x.hour.slice(11, 13) === hh) };
  });
}
const oldMax = (columns: OldColumn[]) => Math.max(4, ...columns.map((c) => c.rows.reduce((s, r) => s + r.stats.runs, 0)));
function oldTicks(columns: OldColumn[]) {
  const plotH = OLD.height - OLD.padTop - OLD.padBottom;
  const max = oldMax(columns);
  return [0, 1, 2, 3, 4].map((i) => ({ y: OLD.padTop + plotH - (i / 4) * plotH, label: String(Math.round((max / 4) * i)) }));
}
function oldBars(columns: OldColumn[]) {
  const plotW = OLD.width - OLD.padLeft - OLD.padRight;
  const plotH = OLD.height - OLD.padTop - OLD.padBottom;
  const step = plotW / Math.max(1, columns.length);
  const width = Math.max(2, Math.min(18, step * 0.7));
  const max = oldMax(columns);
  return columns.map((c, i) => {
    let base = OLD.padTop + plotH;
    const segments = JUDGE0_KINDS.flatMap((k) => {
      const runs = c.rows.filter((r) => r.kind === k.key).reduce((s, r) => s + r.stats.runs, 0);
      if (!runs) return [];
      const h = (runs / max) * plotH;
      base -= h;
      return [{ y: base, h, color: k.color }];
    });
    const parts = c.rows.map((r) => `${judge0KindLabel(r.kind)}: ${r.stats.runs} futás, p95 ${fmtMs(r.stats.p95Ms)}`);
    return { key: c.key, x: OLD.padLeft + i * step + (step - width) / 2, width, label: c.label, title: [c.key, ...parts].join(' · '), segments };
  });
}

describe('AdminKodfuttatoTerhelesComponent', () => {
  async function setup(r: Judge0LoadReport = report) {
    const api = { getReport: vi.fn(() => of(r)) };
    TestBed.configureTestingModule({ imports: [AdminKodfuttatoTerhelesComponent], providers: [{ provide: AdminJudge0LoadService, useValue: api }] });
    const fixture = TestBed.createComponent(AdminKodfuttatoTerhelesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const charts = () => fixture.debugElement.queryAll(By.directive(BarChartComponent)).map((d) => d.componentInstance as BarChartComponent);
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, api, charts };
  }

  it('állapot-kártya a javaslattal és az okokkal, napi táblázat legfrissebb nappal elöl', async () => {
    const { el, c, api, charts } = await setup();
    expect(api.getReport).toHaveBeenCalledWith(7);
    expect(el.textContent).toContain('Figyelni kell');
    expect(el.textContent).toContain('Érdemes figyelni');
    expect(el.textContent).toContain('túlterhelt” (503)');
    expect(c.dailyRows().map((d) => d.date)).toEqual(['2026-10-18', '2026-10-18', '2026-10-17']);
    const daily = charts()[0];
    expect(daily.bars().length).toBe(2);
    expect(daily.bars()[1].segments.length).toBe(2); // futtatás + pontozás halmozva
  });

  it('alapból a legutolsó nap óránként; másik napra váltható', async () => {
    const { c, charts } = await setup();
    expect(c.selectedDay()).toBe('2026-10-18');
    expect(c.hourlyRows().length).toBe(3);
    const hourly = charts()[1];
    expect(hourly.bars().length).toBe(24);
    expect(hourly.bars()[9].segments.length).toBe(2);
    c.selectedDay.set('2026-10-17');
    expect(c.hourlyRows().map((h) => h.hour)).toEqual(['2026-10-17T10:00:00']);
  });

  it('a napi oszlopra kattintva az a nap nyílik meg óránként', async () => {
    const { fixture, c, el } = await setup();
    const overlays = el.querySelectorAll<SVGRectElement>('svg[aria-label="Napi Judge0-futások fajtánként"] rect[fill="transparent"]');
    expect(overlays.length).toBe(2);
    expect(overlays[0].classList.contains('cursor-pointer')).toBe(true);
    overlays[0].dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    expect(c.selectedDay()).toBe('2026-10-17');
    expect(el.textContent).toContain('óránként');
  });

  it('átmeneti összehasonlítás: a diagramok geometriája bájtra azonos a régi oldal-számítással', async () => {
    const big: Judge0LoadReport = {
      ...report,
      daily: [
        ...report.daily,
        { date: '2026-10-16', kind: 'contest', stats: stats(7, null), workHoursP95Ms: null },
        { date: '2026-10-16', kind: 'aspnet', stats: stats(3, 900), workHoursP95Ms: 900 },
        { date: '2026-10-18', kind: 'project', stats: stats(55, 1200), workHoursP95Ms: 1200 },
      ],
      hourly: [...report.hourly, { hour: '2026-10-18T23:00:00', kind: 'project', stats: stats(9, 700) }, { hour: '2026-10-18T00:00:00', kind: 'aspnet', stats: stats(1, 300) }],
    };
    const { fixture, c, charts } = await setup(big);
    for (const day of ['2026-10-18', '2026-10-17', '2026-10-16']) {
      c.selectedDay.set(day);
      fixture.detectChanges();
      const [daily, hourly] = charts();
      const oldDaily = oldDailyColumns(big);
      expect(daily.ticks()).toEqual(oldTicks(oldDaily));
      // a napi oszlop felirata a régi kódban sem jelent meg (csak az óránkéntié) – a felirat mezőt ezért nem vetjük össze
      expect(daily.bars().map((b) => ({ ...b, label: 'nap' }))).toEqual(oldBars(oldDaily));
      const oldHourly = oldHourlyColumns(big, day);
      expect(hourly.ticks()).toEqual(oldTicks(oldHourly));
      expect(hourly.bars()).toEqual(oldBars(oldHourly));
    }
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

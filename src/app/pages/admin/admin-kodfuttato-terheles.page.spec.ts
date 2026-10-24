import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminKodfuttatoTerhelesComponent } from './admin-kodfuttato-terheles.component';
import { Judge0LoadReport, Judge0LoadStats } from '../../models/judge0-load.model';

const API = 'http://localhost:7090/api/admin/judge0-load';

const stats = (runs: number): Judge0LoadStats => ({
  runs, busy: 0, timeouts: 0, systemErrors: 0, completed: runs, p50Ms: 1000, p95Ms: 2000, avgMs: 800, maxMs: 2500,
  avgWaitMs: 100, maxWaitMs: 900, maxQueueDepth: 6, histogram: [runs, 0, 0, 0, 0, 0, 0],
});
const thresholds = { workHourStart: 7, workHourEnd: 20, yellowP95Ms: 2000, redP95Ms: 3000, redBusyRatio: 0.01, redSystemErrorRatio: 0.005, minRunsForP95: 20 };
const report = (days: number, recommendation: string, dates: string[]): Judge0LoadReport => ({
  days, status: 'green', recommendation, reasons: [], thresholds,
  daily: dates.map((date) => ({ date, kind: 'run', stats: stats(10), workHoursP95Ms: 2000 })),
  hourly: dates.map((date) => ({ hour: `${date}T09:00:00`, kind: 'run', stats: stats(10) })),
});

/**
 * Karakterizáció (a WP-C8 előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): a Kódfuttató terhelés oldal betöltése,
 * időszakváltása, hibája és a kiválasztott nap a valódi service-szel + HttpTestingController, DOM-on keresztül.
 */
describe('AdminKodfuttatoTerhelesComponent – betöltés és időszak', () => {
  let fixture: ComponentFixture<AdminKodfuttatoTerhelesComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const text = (root: Element | null) => root?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  async function settle() {
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }
  const spinner = () => el.querySelectorAll('app-local-spinner').length;
  const errorText = () => el.querySelector('p.text-danger')?.textContent?.trim() ?? null;
  const heading = () => text(el.querySelector('.border-l-4 h2'));
  const hourlyTitle = () => [...el.querySelectorAll('h2')].map((h) => text(h)).find((t) => t.endsWith('óránként')) ?? null;
  const dayButton = (d: number) => [...el.querySelectorAll<HTMLButtonElement>('[aria-label="Időszak"] button')].find((b) => text(b) === `${d} nap`)!;
  const reportReq = (days: number) => http.expectOne((r) => r.url === API && r.params.get('days') === String(days));
  const fail = (r: TestRequest) => r.flush(null, { status: 500, statusText: 'Server Error' });
  async function click(b: HTMLElement) {
    b.click();
    await settle();
  }
  async function loaded() {
    await settle();
    reportReq(7).flush(report(7, 'Hét nap', ['2026-10-17', '2026-10-18']));
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminKodfuttatoTerhelesComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminKodfuttatoTerhelesComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  it('betöltés: spinner, 7 nap; utána az állapot-kártya és a legutolsó nap óránként; a 7 nap gomb aktív', async () => {
    await settle();
    expect(spinner()).toBe(1);
    reportReq(7).flush(report(7, 'Hét nap', ['2026-10-17', '2026-10-18']));
    await settle();
    expect(spinner()).toBe(0);
    expect(heading()).toBe('Hét nap');
    expect(hourlyTitle()).toContain('18.');
    expect(dayButton(7).getAttribute('aria-pressed')).toBe('true');
    expect(dayButton(30).getAttribute('aria-pressed')).toBe('false');
  });

  it('időszakváltás: azonnal aktív gomb, spinner a tartalom helyett; az új jelentés legutolsó napja lesz kiválasztva', async () => {
    await loaded();
    el.querySelectorAll<HTMLTableRowElement>('tbody tr.cursor-pointer')[1].click();
    await settle();
    expect(hourlyTitle()).toContain('17.');

    await click(dayButton(30));
    expect(dayButton(30).getAttribute('aria-pressed')).toBe('true');
    expect(spinner()).toBe(1);
    expect(el.querySelector('.border-l-4')).toBeNull();
    reportReq(30).flush(report(30, 'Harminc nap', ['2026-10-01', '2026-10-05']));
    await settle();
    expect(heading()).toBe('Harminc nap');
    expect(hourlyTitle()).toContain('5.');
  });

  it('az aktív időszak újrakattintása is újratölt', async () => {
    await loaded();
    await click(dayButton(7));
    expect(spinner()).toBe(1);
    reportReq(7).flush(report(7, 'Újra hét nap', ['2026-10-18']));
    await settle();
    expect(heading()).toBe('Újra hét nap');
  });

  it('hiba: üzenet, a korábbi jelentés és a kiválasztott nap marad; a következő betöltés törli az üzenetet', async () => {
    await loaded();
    el.querySelectorAll<HTMLTableRowElement>('tbody tr.cursor-pointer')[1].click();
    await settle();
    await click(dayButton(90));
    fail(reportReq(90));
    await settle();
    expect(errorText()).toBe('A kódfuttató terhelés-adatait nem sikerült betölteni.');
    expect(heading()).toBe('Hét nap');
    expect(hourlyTitle()).toContain('17.');
    expect(dayButton(90).getAttribute('aria-pressed')).toBe('true');

    await click(dayButton(30));
    expect(errorText()).toBeNull();
    reportReq(30).flush(report(30, 'Harminc nap', ['2026-10-05']));
    await settle();
  });

  it('első betöltés hibája: csak az üzenet', async () => {
    await settle();
    fail(reportReq(7));
    await settle();
    expect(spinner()).toBe(0);
    expect(errorText()).toBe('A kódfuttató terhelés-adatait nem sikerült betölteni.');
    expect(el.querySelector('.border-l-4')).toBeNull();
  });

  it('gyors időszakváltásnál az előző kérés lemondódik — WP-C8, javulás', async () => {
    await loaded();
    await click(dayButton(30));
    const stale = reportReq(30);
    await click(dayButton(90));
    reportReq(90).flush(report(90, 'Kilencven nap', ['2026-10-18']));
    await settle();
    expect(stale.cancelled).toBe(true);
    expect(heading()).toBe('Kilencven nap');
  });
});

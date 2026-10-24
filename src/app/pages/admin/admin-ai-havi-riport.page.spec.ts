import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminAiHaviRiportComponent, monthKey } from './admin-ai-havi-riport.component';
import { AiSpendingMonthlyReportDto } from '../../models/ai-spending.model';

const API = 'http://localhost:7090/api/admin/ai-spending';

function report(totalUsd: number, name: string): AiSpendingMonthlyReportDto {
  return {
    month: '', totalUsd, requestCount: 7, attributedUsd: totalUsd, unattributedUsd: 0, institutions: [],
    individualStudents: [{ userId: 1, name, email: 'a@x.hu', totalUsd, requestCount: 7, bySource: { chat: totalUsd } }],
    individualTeachers: [], otherUsers: [], unattributed: [],
  };
}

/**
 * Karakterizáció (a WP-C8 előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): a havi riport betöltése, hónapváltása,
 * hibája és újrapróbája, valamint a CSV-letöltés állapota a valódi service-szel + HttpTestingController, DOM-on keresztül.
 */
describe('AdminAiHaviRiportComponent – betöltés és hibák', () => {
  let fixture: ComponentFixture<AdminAiHaviRiportComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  const current = monthKey(new Date());
  const previous = monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const older = monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1));

  const text = (root: Element | null) => root?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  async function settle() {
    fixture.detectChanges();
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }
  const spinner = () => el.querySelectorAll('app-local-spinner').length;
  const tiles = () => text(el.querySelector('[data-testid="report-tiles"]'));
  const alertBox = () => el.querySelector('[role="alert"]');
  const csvButton = () => el.querySelector<HTMLButtonElement>('[data-testid="csv-download"]')!;
  const reportReq = (month: string) => http.expectOne((r) => r.url === `${API}/monthly-report` && r.params.get('month') === month);
  const fail = (r: TestRequest) => r.flush(null, { status: 500, statusText: 'Server Error' });
  async function selectMonth(month: string) {
    const select = el.querySelector<HTMLSelectElement>('[data-testid="month-select"]')!;
    select.value = month;
    select.dispatchEvent(new Event('change'));
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminAiHaviRiportComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminAiHaviRiportComponent);
    el = fixture.nativeElement;
  });

  afterEach(() => http.verify());

  it('betöltés közben spinner; hónapváltáskor a korábbi tartalom helyett spinner, majd az új; ugyanarra a hónapra nincs kérés', async () => {
    await settle();
    expect(spinner()).toBe(1);
    expect(el.querySelector('[data-testid="report-tiles"]')).toBeNull();
    reportReq(current).flush(report(1.5, 'Első Anna'));
    await settle();
    expect(spinner()).toBe(0);
    expect(tiles()).toContain('$1.50');

    await selectMonth(current);
    http.expectNone(`${API}/monthly-report`);

    await selectMonth(previous);
    expect(spinner()).toBe(1);
    expect(el.querySelector('[data-testid="report-tiles"]')).toBeNull();
    reportReq(previous).flush(report(2.25, 'Második Béla'));
    await settle();
    expect(tiles()).toContain('$2.25');
    expect(text(el.querySelector('[data-testid="group-individual-students"]'))).toContain('Második Béla');
  });

  it('gyors hónapváltásnál a korábbi hónap késve érkező válasza nem írja felül az újat', async () => {
    await settle();
    reportReq(current).flush(report(1.5, 'Első Anna'));
    await settle();
    await selectMonth(previous);
    const stale = reportReq(previous);
    await selectMonth(older);
    reportReq(older).flush(report(3, 'Harmadik Cili'));
    await settle();
    if (!stale.cancelled) stale.flush(report(9, 'Régi Dénes'));
    await settle();
    expect(tiles()).toContain('$3.00');
    expect(text(el)).not.toContain('Régi Dénes');
    expect(spinner()).toBe(0);
  });

  it('betöltési hiba: a tartalom eltűnik, hibasor Újra gombbal; az Újra ugyanazt a hónapot tölti, közben spinner, a hiba eltűnik', async () => {
    await settle();
    reportReq(current).flush(report(1.5, 'Első Anna'));
    await settle();
    await selectMonth(previous);
    fail(reportReq(previous));
    await settle();
    expect(el.querySelector('[data-testid="report-tiles"]')).toBeNull();
    expect(spinner()).toBe(0);
    expect(text(alertBox())).toBe('A havi riport betöltése sikertelen.Újra');

    (alertBox()!.querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(alertBox()).toBeNull();
    expect(spinner()).toBe(1);
    reportReq(previous).flush(report(2.25, 'Második Béla'));
    await settle();
    expect(tiles()).toContain('$2.25');
  });

  it('CSV: letöltés közben a gomb tiltva; hibánál hibasor a tartalom mellett, a következő betöltés törli', async () => {
    await settle();
    reportReq(current).flush(report(1.5, 'Első Anna'));
    await settle();
    csvButton().click();
    await settle();
    expect(csvButton().disabled).toBe(true);
    expect(text(csvButton())).toBe('Letöltés…');
    fail(http.expectOne((r) => r.url === `${API}/monthly-report.csv` && r.params.get('month') === current));
    await settle();
    expect(csvButton().disabled).toBe(false);
    expect(text(csvButton())).toBe('CSV letöltése');
    expect(text(alertBox())).toBe('A CSV letöltése nem sikerült.Újra');
    expect(tiles()).toContain('$1.50');

    await selectMonth(previous);
    expect(alertBox()).toBeNull();
    reportReq(previous).flush(report(2.25, 'Második Béla'));
    await settle();
    expect(alertBox()).toBeNull();
  });

  it('a CSV-hiba Újra gombja újratölti a riportot', async () => {
    await settle();
    reportReq(current).flush(report(1.5, 'Első Anna'));
    await settle();
    csvButton().click();
    await settle();
    fail(http.expectOne((r) => r.url === `${API}/monthly-report.csv`));
    await settle();
    (alertBox()!.querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(alertBox()).toBeNull();
    reportReq(current).flush(report(4, 'Negyedik Ede'));
    await settle();
    expect(tiles()).toContain('$4.00');
  });

  it('a keresőszó hónapváltáskor megmarad', async () => {
    await settle();
    reportReq(current).flush(report(1.5, 'Első Anna'));
    await settle();
    const input = el.querySelector<HTMLInputElement>('[data-testid="report-search"]')!;
    input.value = 'senki';
    input.dispatchEvent(new Event('input'));
    await settle();
    expect(el.querySelector('[data-testid="search-empty"]')).not.toBeNull();
    await selectMonth(previous);
    reportReq(previous).flush(report(2, 'Senki Feri'));
    await settle();
    expect(el.querySelector<HTMLInputElement>('[data-testid="report-search"]')!.value).toBe('senki');
    expect(el.querySelectorAll('[data-testid="person-row"]').length).toBe(1);
  });
});

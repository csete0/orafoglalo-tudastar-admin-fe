import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminAiHaviRiportComponent, fmtUsd, monthKey } from './admin-ai-havi-riport.component';
import { AdminAiSpendingService } from '../../services/admin/admin-ai-spending.service';
import { AiSpendingMonthlyReportDto, MonthlyReportPersonDto } from '../../models/ai-spending.model';

function person(userId: number, name: string, totalUsd: number, bySource: Record<string, number> = {}): MonthlyReportPersonDto {
  return { userId, name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, totalUsd, requestCount: 3, bySource };
}

function makeReport(overrides: Partial<AiSpendingMonthlyReportDto> = {}): AiSpendingMonthlyReportDto {
  return {
    month: '2026-10',
    totalUsd: 5.5,
    requestCount: 120,
    attributedUsd: 5,
    unattributedUsd: 0.5,
    institutions: [
      {
        schoolId: 3, schoolName: 'Bessenyei Gimnázium', totalUsd: 2.5, requestCount: 40,
        teachers: [person(95, 'Bátyi András', 1.5, { 'teacher-ai-code-task': 1.2, 'exam-rubric-draft': 0.3 })],
        students: [person(101, 'Kis Anna', 0.2, { chat: 0.2 }), person(102, 'Nagy Béla', 0.8, { classtest: 0.8 })],
      },
      {
        schoolId: 4, schoolName: 'Minta Technikum', totalUsd: 2, requestCount: 30,
        teachers: [], students: [person(201, 'Szabó Cecília', 2, { chat: 2 })],
      },
    ],
    individualStudents: [person(301, 'Egyéni Dóra', 0.4, { chat: 0.4 })],
    individualTeachers: [],
    otherUsers: [person(1, 'Admin Ádám', 0.1, { quizgen: 0.1 })],
    unattributed: [{ source: 'maint', totalUsd: 0.5, requestCount: 40 }],
    ...overrides,
  };
}

describe('AdminAiHaviRiportComponent', () => {
  let svc: { getMonthlyReport: ReturnType<typeof vi.fn>; downloadMonthlyReportCsv: ReturnType<typeof vi.fn> };

  /** A riport rxResource-ból jön: az első érték egy makrotask-kör után érkezik. */
  async function create(report: AiSpendingMonthlyReportDto = makeReport()) {
    svc = {
      getMonthlyReport: vi.fn().mockReturnValue(of(report)),
      downloadMonthlyReportCsv: vi.fn().mockReturnValue(of(new Blob(['x'], { type: 'text/csv' }))),
    };
    TestBed.configureTestingModule({
      imports: [AdminAiHaviRiportComponent],
      providers: [{ provide: AdminAiSpendingService, useValue: svc }],
    });
    const fixture = TestBed.createComponent(AdminAiHaviRiportComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ') ?? '';

  afterEach(() => vi.restoreAllMocks());

  it('az aktuális hónapot tölti be alapból, a választóban 12 hónap közül lehet választani', async () => {
    const fixture = await create();
    const current = monthKey(new Date());
    expect(svc.getMonthlyReport).toHaveBeenCalledWith(current);
    expect(fixture.componentInstance.monthOptions.length).toBe(12);
    expect(fixture.componentInstance.monthOptions[0].key).toBe(current);
  });

  it('hónapváltáskor újra lekéri a riportot', async () => {
    const fixture = await create();
    const prev = fixture.componentInstance.monthOptions[1].key;
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('[data-testid="month-select"]');
    select.value = prev;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(svc.getMonthlyReport).toHaveBeenLastCalledWith(prev);
    expect(svc.getMonthlyReport).toHaveBeenCalledTimes(2);
  });

  it('csempéket, intézményeket tanár/diák bontással, egyéb csoportokat és a nem besorolt részt mutatja', async () => {
    const el: HTMLElement = (await create()).nativeElement;
    expect(text(el.querySelector('[data-testid="report-tiles"]'))).toContain('$5.50');
    expect(text(el.querySelector('[data-testid="report-tiles"]'))).toContain('120');

    const insts = el.querySelectorAll('[data-testid="institution"]');
    expect(insts.length).toBe(2);
    expect(text(insts[0])).toContain('Bessenyei Gimnázium');
    expect(text(insts[0])).toContain('Tanárok (1)');
    expect(text(insts[0])).toContain('Diákok (2)');
    expect(text(insts[0])).toContain('Tanár: AI programozási feladat $1.20');

    expect(text(el.querySelector('[data-testid="group-individual-students"]'))).toContain('Egyéni Dóra');
    expect(el.querySelector('[data-testid="group-individual-teachers"]')).toBeNull();
    expect(text(el.querySelector('[data-testid="group-other-users"]'))).toContain('Admin Ádám');
    expect(text(el.querySelector('[data-testid="group-unattributed"]'))).toContain('Kvíz-karbantartás');
  });

  it('a keresés ékezet-függetlenül névre és e-mailre szűr, az intézményt kinyitja', async () => {
    const fixture = await create();
    const el: HTMLElement = fixture.nativeElement;
    const input: HTMLInputElement = el.querySelector('[data-testid="report-search"]')!;
    input.value = 'nagy bela';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const insts = el.querySelectorAll<HTMLDetailsElement>('[data-testid="institution"]');
    expect(insts.length).toBe(1);
    expect(insts[0].open).toBe(true);
    const rows = el.querySelectorAll('[data-testid="person-row"]');
    expect(rows.length).toBe(1);
    expect(text(rows[0])).toContain('Nagy Béla');
    expect(el.querySelector('[data-testid="group-unattributed"]')).toBeNull();

    input.value = 'senki';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="search-empty"]')).not.toBeNull();
  });

  it('költség szerint rendez, a gombbal megfordítható', async () => {
    const fixture = await create();
    const c = fixture.componentInstance;
    expect(c.institutions().map((i) => i.schoolId)).toEqual([3, 4]);
    expect(c.institutions()[0].students.map((s) => s.name)).toEqual(['Nagy Béla', 'Kis Anna']);

    (fixture.nativeElement.querySelector('[data-testid="sort-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(c.institutions().map((i) => i.schoolId)).toEqual([4, 3]);
    expect(c.institutions()[1].students.map((s) => s.name)).toEqual(['Kis Anna', 'Nagy Béla']);
  });

  it('üres hónapnál üres-állapotot mutat', async () => {
    const el: HTMLElement = (await create(
      makeReport({ totalUsd: 0, requestCount: 0, attributedUsd: 0, unattributedUsd: 0, institutions: [], individualStudents: [], otherUsers: [], unattributed: [] }),
    )).nativeElement;
    expect(el.querySelector('[data-testid="report-empty"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="institution"]')).toBeNull();
  });

  it('betöltési hibánál hibaüzenetet és Újra gombot mutat', async () => {
    TestBed.configureTestingModule({
      imports: [AdminAiHaviRiportComponent],
      providers: [{ provide: AdminAiSpendingService, useValue: { getMonthlyReport: vi.fn().mockReturnValue(throwError(() => new Error('x'))) } }],
    });
    const fixture = TestBed.createComponent(AdminAiHaviRiportComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(text(alert)).toContain('A havi riport betöltése sikertelen.');
    expect(text(alert)).toContain('Újra');
  });

  it('a CSV-t ai-koltes-YYYY-MM.csv néven tölti le', async () => {
    const fixture = await create();
    let downloadName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download;
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x');
    URL.revokeObjectURL = vi.fn();

    (fixture.nativeElement.querySelector('[data-testid="csv-download"]') as HTMLButtonElement).click();
    const month = fixture.componentInstance.month();
    expect(svc.downloadMonthlyReportCsv).toHaveBeenCalledWith(month);
    expect(downloadName).toBe(`ai-koltes-${month}.csv`);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });
});

describe('fmtUsd (havi riport)', () => {
  it('kis összegeket is értékes jegyekkel mutat', () => {
    expect([0, 0.0003, 0.00104, 0.05, 1.256, 0.009].map(fmtUsd)).toEqual(['$0', '$0.0003', '$0.00104', '$0.050', '$1.26', '$0.009']);
  });
});

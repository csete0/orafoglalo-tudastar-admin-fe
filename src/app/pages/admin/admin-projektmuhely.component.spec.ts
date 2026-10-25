import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Subject, of, throwError } from 'rxjs';
import { AdminProjektmuhelyComponent } from './admin-projektmuhely.component';
import { ProjektmuhelyAttekintesComponent } from './projektmuhely/projektmuhely-attekintes.component';
import { ProjektmuhelyTolcserComponent } from './projektmuhely/projektmuhely-tolcser.component';
import { UsdPipe } from '../../shared/format/usd.pipe';
import { AdminProjektmuhelyService } from '../../services/admin/admin-projektmuhely.service';
import { AI_SOURCES } from '../../models/ai-spending.model';
import { ProjectAdminCosts, ProjectAdminFunnel, ProjectAdminOverview, ProjectAdminTechnikumStats } from '../../models/projektmuhely.model';

const overview: ProjectAdminOverview = {
  days: 30,
  projects: [{ slug: 'bufe-rendelo', title: 'Büfé-rendelő', isPublished: true, milestoneCount: 7, started: 10, completed: 2, active7: 4, active30: 8,
    byRuntime: { 'browser-python': 7, 'judge0-csharp': 3 } }],
  daily: [
    { date: '2026-09-30', checks: 5, previews: 2, aiRequests: 3, aiCostUsd: 0.004 },
    { date: '2026-10-01', checks: 7, previews: 0, aiRequests: 1, aiCostUsd: 0.001 },
  ],
};
const funnel: ProjectAdminFunnel = {
  slug: 'bufe-rendelo', title: 'Büfé-rendelő', started: 10,
  milestones: [
    { orderNo: 1, title: 'Az adatbázis', kind: 'build', reached: 10, passed: 9, avgChecks: 2.1, hint1: 3, hint2: 1, hint3: 0, medianMinutesToPass: 35 },
    { orderNo: 2, title: 'A menü', kind: 'build', reached: 9, passed: 4, avgChecks: 4.5, hint1: 8, hint2: 5, hint3: 2, medianMinutesToPass: 130 },
    { orderNo: 3, title: 'Rendelés', kind: 'build', reached: 4, passed: 3, avgChecks: 3, hint1: 1, hint2: 0, hint3: 0, medianMinutesToPass: null },
  ],
};
const costs: ProjectAdminCosts = {
  days: 30, totalAiUsd: 0.005, unattributedAiUsd: 0.001, checks: 12, previews: 2, judge0CpuSeconds: 30,
  bySource: [{ source: 'project-hint', requests: 3, costUsd: 0.004 }, { source: 'project-review', requests: 0, costUsd: 0 }, { source: 'project-error', requests: 1, costUsd: 0.001 }],
  byProject: [{ slug: 'bufe-rendelo', title: 'Büfé-rendelő', aiRequests: 3, aiCostUsd: 0.004, checks: 12, previews: 2, judge0CpuSeconds: 30, activeStudents: 8, aiCostPerActiveStudentUsd: 0.0005 }],
};

const technikum: ProjectAdminTechnikumStats = {
  days: 30,
  projects: [{ slug: 'konyvtar', title: 'Könyvtári kölcsönzés', kind: 'exam', isPublished: true, parts: [
    { partKey: 'console', maxPoints: 15,
      exam: { results: 2, students: 2, avgPercent: 60, failRatePercent: 50 },
      practice: { results: 0, students: 0, avgPercent: null, failRatePercent: null } },
  ] }],
};

describe('AdminProjektmuhelyComponent', () => {
  async function setup() {
    const api = { getOverview: vi.fn(() => of(overview)), getCosts: vi.fn(() => of(costs)), getFunnel: vi.fn(() => of(funnel)),
      getTechnikum: vi.fn((days: number) => of({ ...technikum, days })) };
    TestBed.configureTestingModule({ imports: [AdminProjektmuhelyComponent], providers: [{ provide: AdminProjektmuhelyService, useValue: api }] });
    const fixture = TestBed.createComponent(AdminProjektmuhelyComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const child = <T>(type: Type<T>): T => fixture.debugElement.query(By.directive(type)).componentInstance;
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, api, child };
  }

  it('a Projektműhely AI-forrásai az AI-költés oldalon is ismertek (különben a diagram kihagyná őket)', () => {
    expect(AI_SOURCES.map((s) => s.key)).toEqual(expect.arrayContaining(['project-hint', 'project-review', 'project-error']));
  });

  it('áttekintés: projekt-sor nyelvekkel, napi futtatás-összesítő', async () => {
    const { el, child } = await setup();
    const ov = child(ProjektmuhelyAttekintesComponent);
    expect(el.textContent).toContain('Büfé-rendelő');
    expect(ov.runtimes(overview.projects[0].byRuntime)).toBe('Python 7 · C# 3');
    expect(ov.totals()).toEqual({ checks: 12, previews: 2, aiRequests: 4, aiCostUsd: 0.005 });
    expect(ov.columns().length).toBe(2);
  });

  it('tölcsér: a legnagyobb lemorzsolódás lépése kiemelve, az idő emberi egységben', async () => {
    const { c, el, fixture, child } = await setup();
    c.activeTab.set('tolcser');
    fixture.detectChanges();
    const t = child(ProjektmuhelyTolcserComponent);
    expect(t.worstDrop()).toBe(2);
    expect(el.textContent).toContain('legnagyobb lemorzsolódás');
    expect(t.fmtMinutes(35)).toBe('35 perc');
    expect(t.fmtMinutes(130)).toBe('2.2 óra');
    expect(t.fmtMinutes(null)).toBe('–');
    const usd = new UsdPipe();
    expect([0.00012, 0.05, 0, 3.456].map((v) => usd.transform(v, 'fine'))).toEqual(['$0.0001', '$0.050', '$0.00', '$3.46']);
  });

  it('tölcsér az áttekintésből: a választó a kattintott (nem az első) projektet mutatja (UI-TT-254)', async () => {
    const { c, el, fixture, api } = await setup();
    const second = { ...overview.projects[0], slug: 'osztalykassza', title: 'Osztálykassza' };
    api.getOverview.mockReturnValue(of({ ...overview, projects: [overview.projects[0], second] }));
    c.days.set(7);
    fixture.detectChanges();
    await fixture.whenStable();
    c.openFunnel('osztalykassza');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((el.querySelector('#pm-funnel-project') as HTMLSelectElement).value).toBe('osztalykassza');
  });

  it('költség: időszakváltáskor újratölt', async () => {
    const { c, api, fixture } = await setup();
    c.setDays(7);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(api.getOverview).toHaveBeenLastCalledWith(7);
    expect(api.getCosts).toHaveBeenLastCalledWith(7);
  });

  it('technikum: a fülre lépve tölt; részenként átlag és bukási arány vizsgára és gyakorlásra; időszakváltáskor újratölt', async () => {
    const { c, el, fixture, api } = await setup();
    const tabLabels = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"], .tab-btn')].map((b) => b.textContent?.trim());
    expect(tabLabels).toContain('Fejlesztőműhely');
    expect(tabLabels).not.toContain('Technikum');
    expect(api.getTechnikum).not.toHaveBeenCalled();
    c.selectTab('technikum');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.getTechnikum).toHaveBeenCalledWith(30);
    const card = el.querySelector('[data-testid="technikum-konyvtar"]')!;
    expect(card.textContent).toContain('próbavizsga');
    const cells = [...card.querySelectorAll('tbody td')].map((td) => td.textContent!.trim());
    expect(cells[0]).toContain('Konzolos alkalmazás');
    expect(cells.slice(1)).toEqual(['2 (2)', '60.0%', '50.0%', '0 (0)', '–', '–']);

    c.setDays(7);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(api.getTechnikum).toHaveBeenLastCalledWith(7);
  });

  it('technikum: a betöltés alatt töltésjelző, hibánál a BE üzenete (kikapcsolt modul) látszik', async () => {
    const { c, el, fixture, api } = await setup();
    api.getTechnikum.mockReturnValueOnce(throwError(() => ({ status: 404, error: { errorType: 'FeatureDisabled', errorMessage: 'A technikumi modul nincs bekapcsolva.' } })));
    c.selectTab('technikum');
    expect(c.technikumLoading()).toBe(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(c.technikumLoading()).toBe(false);
    expect(el.textContent).toContain('A technikumi modul nincs bekapcsolva.');
    api.getTechnikum.mockReturnValueOnce(throwError(() => new Error('x')));
    c.setDays(14);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(c.error()).toBe('A Fejlesztőműhely-statisztikát nem sikerült betölteni.');
  });
  it('technikum: gyors nap-váltásnál a később érkező régi válasz nem írja felül az újat', async () => {
    const { c, api, fixture } = await setup();
    c.selectTab('technikum');
    fixture.detectChanges();
    await fixture.whenStable();
    const slow = new Subject<ProjectAdminTechnikumStats>();
    api.getTechnikum.mockReturnValueOnce(slow);
    c.setDays(7);
    fixture.detectChanges();
    expect(api.getTechnikum).toHaveBeenLastCalledWith(7);
    c.setDays(90);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(c.technikum()?.days).toBe(90);
    slow.next({ ...technikum, days: 7 });
    slow.complete();
    await fixture.whenStable();
    expect(c.technikum()?.days).toBe(90);
    expect(c.technikumLoading()).toBe(false);
  });
});

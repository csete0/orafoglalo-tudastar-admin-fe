import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminProjektmuhelyComponent } from './admin-projektmuhely.component';
import { AdminProjektmuhelyService } from '../../services/admin/admin-projektmuhely.service';
import { AI_SOURCES } from '../../models/ai-spending.model';
import { ProjectAdminCosts, ProjectAdminFunnel, ProjectAdminOverview } from '../../models/projektmuhely.model';

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

describe('AdminProjektmuhelyComponent', () => {
  async function setup() {
    const api = { getOverview: vi.fn(() => of(overview)), getCosts: vi.fn(() => of(costs)), getFunnel: vi.fn(() => of(funnel)) };
    TestBed.configureTestingModule({ imports: [AdminProjektmuhelyComponent], providers: [{ provide: AdminProjektmuhelyService, useValue: api }] });
    const fixture = TestBed.createComponent(AdminProjektmuhelyComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, api };
  }

  it('a Projektműhely AI-forrásai az AI-költés oldalon is ismertek (különben a diagram kihagyná őket)', () => {
    expect(AI_SOURCES.map((s) => s.key)).toEqual(expect.arrayContaining(['project-hint', 'project-review', 'project-error']));
  });

  it('áttekintés: projekt-sor nyelvekkel, napi futtatás-összesítő', async () => {
    const { el, c } = await setup();
    expect(el.textContent).toContain('Büfé-rendelő');
    expect(c.runtimes(overview.projects[0].byRuntime)).toBe('Python 7 · C# 3');
    expect(c.totals()).toEqual({ checks: 12, previews: 2, aiRequests: 4, aiCostUsd: 0.005 });
    expect(c.bars().length).toBe(2);
  });

  it('tölcsér: a legnagyobb lemorzsolódás lépése kiemelve, az idő emberi egységben', async () => {
    const { c, el, fixture } = await setup();
    c.activeTab.set('tolcser');
    fixture.detectChanges();
    expect(c.worstDrop()).toBe(2);
    expect(el.textContent).toContain('legnagyobb lemorzsolódás');
    expect(c.fmtMinutes(35)).toBe('35 perc');
    expect(c.fmtMinutes(130)).toBe('2.2 óra');
    expect(c.fmtMinutes(null)).toBe('–');
    expect([c.fmtUsd(0.00012), c.fmtUsd(0.05), c.fmtUsd(0), c.fmtUsd(3.456)]).toEqual(['$0.0001', '$0.050', '$0.00', '$3.46']);
  });

  it('költség: időszakváltáskor újratölt', async () => {
    const { c, api } = await setup();
    await c.setDays(7);
    expect(api.getOverview).toHaveBeenLastCalledWith(7);
    expect(api.getCosts).toHaveBeenLastCalledWith(7);
  });
});

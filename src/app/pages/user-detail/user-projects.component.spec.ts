import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserProjectsComponent } from './user-projects.component';
import { ProjectAdminUserProject } from '../../models/projektmuhely.model';

describe('UserProjectsComponent', () => {
  let fixture: ComponentFixture<UserProjectsComponent>;

  function render(projects: ProjectAdminUserProject[] | null): string {
    fixture = TestBed.createComponent(UserProjectsComponent);
    fixture.componentRef.setInput('projects', projects);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('null: hibaüzenet; üres lista: „Még nem kezdett projektet.”', () => {
    expect(render(null)).toContain('A Projektműhely-adatokat nem sikerült betölteni.');
    expect(render([])).toContain('Még nem kezdett projektet.');
  });

  it('a költség 0,01 $ alatt 4, fölötte 3 tizedessel; az utolsó aktivitás percre vágva', () => {
    const row = (aiCostUsd30: number, lastActivityAt: string | null): ProjectAdminUserProject => ({
      slug: `p${aiCostUsd30}`, title: 'P', runtime: 'judge0-java', currentMilestoneOrder: 1, milestoneCount: 2, passedCount: 0, checks: 0,
      hint1: 0, hint2: 0, hint3: 0, aiCostUsd30, startedAt: '2026-09-01T00:00:00', completedAt: null, lastActivityAt,
    });
    const cells = (i: number) =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')[i].querySelectorAll('td')).map((td) => td.textContent?.trim());
    render([row(0.0099, '2026-10-02T07:08:09'), row(0.01, null)]);
    expect(cells(0)).toEqual(['P', 'Java', '1.', '0 / 2', '0', '0 · 0 · 0', '$0.0099', '2026-10-02 07:08']);
    expect(cells(1).slice(6)).toEqual(['$0.010', '-']);
  });
});

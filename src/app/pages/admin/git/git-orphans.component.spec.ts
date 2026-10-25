import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { GitOrphansComponent } from './git-orphans.component';
import { AdminGitService } from '../../../services/admin/admin-git.service';
import { GitOrphanRepo } from '../../../models/git.model';

const row = (o: Partial<GitOrphanRepo>): GitOrphanRepo => ({
  id: 1, name: 't9-c-kodfaragok', status: 'marked', firstSeenAt: '2026-10-25T03:20:00Z', lastSeenAt: '2026-10-25T03:20:00Z',
  deletedAt: null, deletesAfter: '2026-11-01T03:20:00Z', ...o,
});

/** Árva tárolók listája (K6): jelöltek a törlés legkorábbi napjával, a törölt sorok idővel, hibánál üzenet. */
describe('GitOrphansComponent', () => {
  function render(orphans: () => ReturnType<AdminGitService['orphans']>) {
    TestBed.configureTestingModule({ imports: [GitOrphansComponent], providers: [{ provide: AdminGitService, useValue: { orphans } }] });
    const fixture = TestBed.createComponent(GitOrphansComponent);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('a jelölt és a törölt tárolók külön címkével, összesítővel látszanak', () => {
    const el = render(() => of([row({}), row({ id: 2, name: 't10-c-harmas-fogat', status: 'deleted', deletedAt: '2026-11-02T03:20:00Z' })]));
    expect(el.querySelector('[data-testid="git-orphans-summary"]')?.textContent).toContain('1 megjelölt · 1 törölve');
    expect(el.querySelector('[data-testid="git-orphan-1"]')?.textContent).toContain('törlés legkorábban 2026.11.01.');
    expect(el.querySelector('[data-testid="git-orphan-2"]')?.textContent).toContain('törölve');
  });

  it('üres listánál és hibánál is érthető szöveg', () => {
    expect(render(() => of([])).textContent).toContain('Nincs árva tároló.');
    TestBed.resetTestingModule();
    expect(render(() => throwError(() => new Error('x'))).textContent).toContain('nem tölthető be');
  });
});

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminGitComponent } from './admin-git.component';
import { AdminGitService } from '../../services/admin/admin-git.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';

const quota = { repoMaxMb: 50, reposPerUser: 20, fileMaxMb: 5, pushesPerMinute: 6, clonesPerMinute: 20, snapshotMaxMb: 10, teamRepoMaxMb: 50, updatedAt: '2027-03-06T10:00:00Z' };
const repo = { id: 7, name: 'u12-p-bufe', ownerUserId: 12, ownerEmail: 'diak@x.hu', ownerTeamId: null, purpose: 'project', projectSlug: 'bufe', sizeKb: 2048,
  lastPushAt: null, locked: false, lockReason: null, overQuota: false, createdAt: '2027-03-06T10:00:00Z' } as const;

describe('AdminGitComponent', () => {
  function setup() {
    const api = {
      getQuota: vi.fn(() => of(quota)), updateQuota: vi.fn((q) => of({ ...quota, ...q })), searchRepos: vi.fn(() => of([repo])),
      lock: vi.fn(() => of(undefined)), unlock: vi.fn(() => of(undefined)), remove: vi.fn(() => of(undefined)),
    };
    const confirm = { ask: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      imports: [AdminGitComponent],
      providers: [{ provide: AdminGitService, useValue: api }, { provide: ConfirmService, useValue: confirm }],
    });
    const fixture = TestBed.createComponent(AdminGitComponent);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, api, confirm };
  }

  it('betöltéskor a kvóták és a tárolók látszanak; mentéskor a módosított kvóta megy', async () => {
    const { fixture, c, el, api } = setup();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('u12-p-bufe');
    expect(el.textContent).toContain('diak@x.hu');
    expect(el.textContent).toContain('projekt');
    c.form.controls.repoMaxMb.setValue(60);
    await c.saveQuota();
    expect(api.updateQuota).toHaveBeenCalledWith(expect.objectContaining({ repoMaxMb: 60 }));
  });

  it('zárolás okkal, majd törlés megerősítés után; utána újratölt', async () => {
    const { fixture, c, api, confirm } = setup();
    await fixture.whenStable();
    c.lockReason.set('visszaélés');
    await c.lock(repo);
    expect(api.lock).toHaveBeenCalledWith(7, 'visszaélés');
    // A keresés rxResource: az újratöltés a következő változás-észleléskor indul.
    fixture.detectChanges();
    await fixture.whenStable();
    await c.remove(repo);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(confirm.ask).toHaveBeenCalledWith(expect.objectContaining({ danger: true }));
    expect(api.remove).toHaveBeenCalledWith(7);
    expect(api.searchRepos).toHaveBeenCalledTimes(3);
  });

  it('zárolás: ok nélkül nem megy (a gomb tiltva, hívás nincs); megerősítés a tárolóval és az okkal; elutasításnál nem zárol', async () => {
    const { fixture, c, el, api, confirm } = setup();
    await fixture.whenStable();
    fixture.detectChanges();
    const lockBtn = () => [...el.querySelectorAll<HTMLButtonElement>('[data-testid="git-repo-7"] button')].find((b) => b.textContent!.trim() === 'Zárolás')!;
    expect(lockBtn().disabled).toBe(true);
    await c.lock(repo);
    expect(confirm.ask).not.toHaveBeenCalled();
    expect(api.lock).not.toHaveBeenCalled();
    expect(c.error()).toContain('okát');

    c.lockReason.set('  spam  ');
    fixture.detectChanges();
    expect(lockBtn().disabled).toBe(false);
    confirm.ask.mockResolvedValueOnce(false);
    await c.lock(repo);
    expect(confirm.ask).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/u12-p-bufe.*diak@x\.hu.*„spam”/) }));
    expect(api.lock).not.toHaveBeenCalled();
    await c.lock(repo);
    expect(api.lock).toHaveBeenCalledWith(7, 'spam');
    expect(c.lockReason()).toBe('');
  });

  it('feloldás megerősítés után; elutasításnál nem old fel', async () => {
    const { fixture, c, api, confirm } = setup();
    await fixture.whenStable();
    const locked = { ...repo, locked: true, lockReason: 'spam' };
    confirm.ask.mockResolvedValueOnce(false);
    await c.unlock(locked);
    expect(api.unlock).not.toHaveBeenCalled();
    await c.unlock(locked);
    expect(confirm.ask).toHaveBeenLastCalledWith(expect.objectContaining({ message: expect.stringContaining('spam') }));
    expect(api.unlock).toHaveBeenCalledWith(7);
  });

  it('érvénytelen kvótánál a Mentés tiltva; a kérés updatedAt nélkül megy', async () => {
    const { fixture, c, el, api } = setup();
    await fixture.whenStable();
    fixture.detectChanges();
    const input = el.querySelector<HTMLInputElement>('input[name="snapshotMaxMb"]')!;
    input.value = '51';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('[data-testid="git-quota-save"]')!.disabled).toBe(true);
    input.value = '20';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('[data-testid="git-quota-save"]')!.disabled).toBe(false);
    await c.saveQuota();
    expect(api.updateQuota.mock.calls[0][0]).not.toHaveProperty('updatedAt');
  });

  it('elutasított megerősítésnél nem töröl', async () => {
    const { fixture, c, api, confirm } = setup();
    await fixture.whenStable();
    confirm.ask.mockResolvedValueOnce(false);
    await c.remove(repo);
    expect(api.remove).not.toHaveBeenCalled();
  });
});

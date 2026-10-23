import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { UserDetailComponent } from './user-detail.component';
import { UserPracticeCreditComponent } from './user-practice-credit.component';
import { UserDetail, UserService } from '../../services/users/user.service';
import { AdminProjektmuhelyService } from '../../services/admin/admin-projektmuhely.service';
import { AdminPracticeGradesService } from '../../services/admin/admin-practice-grades.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { PracticeGradeUserDetail } from '../../models/practice-grades.model';

const user: UserDetail = {
  id: 89, email: 'diak@example.com', userName: 'diak', firstName: 'Teszt', lastName: 'Diák', createdAt: null,
  emailConfirmed: true, isLockedOut: false, roles: ['User'], trialEndsAt: null,
  subscriptions: [], payments: [], groupMemberships: [], parentEmails: [], teacherProfile: null,
};

const practice = (overrides: Partial<PracticeGradeUserDetail> = {}): PracticeGradeUserDetail => ({
  tier: 'free',
  quotas: [
    { kind: 'code', usedToday: 2, dailyLimit: 2, usedThisMonth: 7, monthlyLimit: 20, creditToday: 0 },
    { kind: 'files', usedToday: 1, dailyLimit: 3, usedThisMonth: 4, monthlyLimit: null, creditToday: 0 },
  ],
  grades: [
    { id: 5, createdAt: '2026-10-10T09:00:00Z', kind: 'code', taskId: 1, taskTitle: 'Kamatos kamat', taskSetTitle: 'Python alapok',
      status: 'ok', points: 12, max: 15, costUsd: 0.0078 },
    { id: 4, createdAt: '2026-10-10T08:00:00Z', kind: 'sql', taskId: 2, taskTitle: 'Lekérdezés', taskSetTitle: 'SQL',
      status: 'failed', points: null, max: null, costUsd: null },
  ],
  ...overrides,
});

/** Felhasználó-részlet: gyakorló értékelések + kézi keret-jóváírás (PATRICKS-GYAKORLO-ERTEKELES-TERV.md, 6b). */
describe('UserDetailComponent – gyakorló értékelések', () => {
  let practiceSvc: { getUser: ReturnType<typeof vi.fn>; credit: ReturnType<typeof vi.fn> };
  let confirm: { ask: ReturnType<typeof vi.fn> };

  async function render() {
    TestBed.configureTestingModule({
      imports: [UserDetailComponent],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: { getDetail: vi.fn(() => of(user)) } },
        { provide: AdminProjektmuhelyService, useValue: { getUserProjects: vi.fn(() => of([])) } },
        { provide: AdminPracticeGradesService, useValue: practiceSvc },
        { provide: ConfirmService, useValue: confirm },
      ],
    });
    const fixture = TestBed.createComponent(UserDetailComponent);
    fixture.componentRef.setInput('id', '89');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  /** A kézi jóváírás űrlap-komponense (a gyakorló szakaszon belül). */
  const credit = (fixture: ComponentFixture<UserDetailComponent>): UserPracticeCreditComponent =>
    fixture.debugElement.query(By.directive(UserPracticeCreditComponent)).componentInstance;

  beforeEach(() => {
    practiceSvc = {
      getUser: vi.fn(() => of(practice())),
      credit: vi.fn(() => of(practice({ quotas: [{ kind: 'code', usedToday: 2, dailyLimit: 7, usedThisMonth: 7, monthlyLimit: 25, creditToday: 5 }] }))),
    };
    confirm = { ask: vi.fn(() => Promise.resolve(true)) };
  });

  it('a keret állását típusonként és az értékeléseket (pont, állapot, költség) mutatja', async () => {
    const el: HTMLElement = (await render()).nativeElement;
    const section = el.querySelector('[data-testid="practice-grades"]')!;
    const quotas = section.querySelectorAll('[data-testid="practice-quota"]');
    expect(practiceSvc.getUser).toHaveBeenCalledWith(89);
    expect(quotas[0].textContent).toContain('ma 2 / 2');
    expect(quotas[0].textContent).toContain('a hónapban 7 / 20');
    // Az irodainak nincs havi kerete.
    expect(quotas[1].textContent).not.toContain('hónapban');
    const rows = section.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('12 / 15');
    expect(rows[0].textContent).toContain('$0.0078');
    expect(rows[1].classList).toContain('flagged');
    expect(rows[1].textContent).not.toContain('null');
  });

  it('a jóváírás megerősítés után megy el, és a frissített keret jelenik meg', async () => {
    const fixture = await render();
    const c = credit(fixture);
    c.form.patchValue({ amount: 5, reason: '  support #123  ' });
    await c.grantCredit();
    fixture.detectChanges();

    expect(confirm.ask).toHaveBeenCalledOnce();
    expect(practiceSvc.credit).toHaveBeenCalledWith(89, { kind: 'code', amount: 5, reason: 'support #123' });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="practice-quota"]')!.textContent).toContain('ma 2 / 7 (+5 jóváírva)');
    expect(el.textContent).toContain('Keret jóváírva.');
    expect(c.form.controls.reason.value).toBe('');
  });

  it('elutasított megerősítésnél nem ír jóvá', async () => {
    confirm.ask.mockResolvedValue(false);
    const c = credit(await render());
    c.form.patchValue({ reason: 'support' });
    await c.grantCredit();
    expect(practiceSvc.credit).not.toHaveBeenCalled();
  });

  it('indoklás nélkül vagy érvénytelen darabbal a jóváírás nem indul', async () => {
    const c = credit(await render());
    c.form.patchValue({ reason: '   ' });
    await c.grantCredit();
    c.form.patchValue({ reason: 'support', amount: 0 });
    await c.grantCredit();
    c.form.patchValue({ amount: 2.5 });
    await c.grantCredit();
    expect(confirm.ask).not.toHaveBeenCalled();
    expect(practiceSvc.credit).not.toHaveBeenCalled();
  });

  it('a BE hibaüzenetét mutatja, ha a jóváírás nem sikerül', async () => {
    practiceSvc.credit.mockReturnValue(throwError(() => ({ error: { errorMessage: 'Legfeljebb 50 jóváírható.' } })));
    const fixture = await render();
    credit(fixture).form.patchValue({ reason: 'support' });
    await credit(fixture).grantCredit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Legfeljebb 50 jóváírható.');
  });

  it('ha a gyakorló végpont nem érhető el, csak ez a szakasz jelez hibát, a többi oldal betölt', async () => {
    practiceSvc.getUser.mockReturnValue(throwError(() => ({ status: 404 })));
    const el: HTMLElement = (await render()).nativeElement;
    expect(el.textContent).toContain('Teszt Diák');
    expect(el.textContent).toContain('A gyakorló értékeléseket nem sikerült betölteni.');
  });
});

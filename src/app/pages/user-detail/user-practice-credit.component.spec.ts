import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { UserPracticeCreditComponent } from './user-practice-credit.component';
import { AdminPracticeGradesService } from '../../services/admin/admin-practice-grades.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { PracticeGradeUserDetail, PracticeGradeUserQuota } from '../../models/practice-grades.model';

const quota = (kind: string): PracticeGradeUserQuota =>
  ({ kind, usedToday: 0, dailyLimit: 2, usedThisMonth: 0, monthlyLimit: 20, creditToday: 0 });
const response: PracticeGradeUserDetail = { tier: 'free', quotas: [quota('sql')], grades: [] };

describe('UserPracticeCreditComponent', () => {
  let fixture: ComponentFixture<UserPracticeCreditComponent>;
  let credit: ReturnType<typeof vi.fn>;
  let ask: ReturnType<typeof vi.fn>;

  function render(quotas: PracticeGradeUserQuota[]) {
    credit = vi.fn(() => of(response));
    ask = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      imports: [UserPracticeCreditComponent],
      providers: [
        { provide: AdminPracticeGradesService, useValue: { credit } },
        { provide: ConfirmService, useValue: { ask } },
      ],
    });
    fixture = TestBed.createComponent(UserPracticeCreditComponent);
    fixture.componentRef.setInput('userId', 89);
    fixture.componentRef.setInput('quotas', quotas);
    fixture.detectChanges();
    return fixture.componentInstance;
  }
  const button = () => (fixture.nativeElement as HTMLElement).querySelector('button')!;

  it('alapból „Kód”, 5 darab, üres indoklás; a gomb indoklás nélkül tiltott', () => {
    const c = render([quota('files'), quota('code')]);
    expect(c.form.getRawValue()).toEqual({ kind: 'code', amount: 5, reason: '' });
    expect(button().disabled).toBe(true);
  });

  it('ha a „Kód” nincs a keretek között, az első típus az alapértelmezett, és az megy el', async () => {
    const c = render([quota('sql'), quota('files')]);
    expect(c.form.controls.kind.value).toBe('sql');
    c.form.patchValue({ reason: 'support' });
    await c.grantCredit();
    expect(credit).toHaveBeenCalledWith(89, { kind: 'sql', amount: 5, reason: 'support' });
  });

  it('a gépelt indoklás engedélyezi a gombot; a megerősítő szöveg a darabot és a típus nevét mutatja', async () => {
    const c = render([quota('code')]);
    const emitted: PracticeGradeUserDetail[] = [];
    c.credited.subscribe((r) => emitted.push(r));
    const reason = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type="text"]')!;
    reason.value = 'jegy #9';
    reason.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button().disabled).toBe(false);
    button().click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Kézi keret-jóváírás',
      message: '+5 gyakorló értékelés (Kód) a mai napi és az e havi keretre. A jóváírás az audit-naplóba kerül. Folytatod?',
      confirmLabel: 'Jóváírás',
    }));
    expect(emitted).toEqual([response]);
    expect(reason.value).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Keret jóváírva.');
  });
});

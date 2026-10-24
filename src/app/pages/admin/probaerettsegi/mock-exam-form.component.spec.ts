import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockExamFormComponent, MockExamFormTarget } from './mock-exam-form.component';
import { ToastService } from '../../../shared/toast/toast.service';
import { AdminMockExam, AdminMockExamTaskSetOption, AdminMockExamUpsert, toBudapestInput } from '../../../models/mock-exam.model';

const EVENT: AdminMockExam = {
  id: 4, slug: 'osz-2026', title: 'Őszi', registrationOpensAt: '2026-03-29T00:30:00', opensAt: '2026-03-29T01:30:00',
  startClosesAt: '2026-10-25T00:30:00', resultsPlannedAt: '2026-10-25T01:30:00Z', resultsPublishedAt: null, practiceReleaseAt: '2026-12-31T23:00:00+00:00',
  releasedAsPracticeAt: null, kozepTaskSetId: 1, emeltTaskSetId: 2, kozepTimeLimitSeconds: 5430, emeltTimeLimitSeconds: 14400,
  totalBudgetUsd: 500, badgeKeyPrefix: 'MOCK_1', isPublished: true, hasSessions: false, registrations: 0,
};
const OPTIONS: AdminMockExamTaskSetOption[] = [{ id: 5, title: 'A', level: null }, { id: 6, title: 'B', level: null }];

/** WP-C4: az űrlap határán történő UTC → budapesti konverzió és a percek ↔ másodpercek oda-vissza. */
describe('MockExamFormComponent', () => {
  let fixture: ComponentFixture<MockExamFormComponent>;
  let el: HTMLElement;
  let emitted: AdminMockExamUpsert[];
  let danger: ReturnType<typeof vi.spyOn>;

  function render(target: MockExamFormTarget, options = OPTIONS) {
    fixture = TestBed.createComponent(MockExamFormComponent);
    fixture.componentRef.setInput('target', target);
    fixture.componentRef.setInput('options', options);
    emitted = [];
    fixture.componentInstance.saved.subscribe((v) => emitted.push(v));
    fixture.detectChanges();
    el = fixture.nativeElement;
  }
  const field = (name: string) => el.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  function type(name: string, value: string) {
    field(name).value = value;
    field(name).dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  function submit() {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    danger = vi.spyOn(TestBed.inject(ToastService), 'danger').mockImplementation(() => undefined);
  });

  it('UTC → budapesti mezőérték a nyári/téli időszámítás határain is; változatlan mentés ugyanazt küldi vissza', () => {
    render({ event: EVENT });
    expect(['reg', 'opens', 'closes', 'results', 'practice'].map((n) => field(n).value)).toEqual([
      '2026-03-29T01:30', '2026-03-29T03:30', '2026-10-25T02:30', '2026-10-25T02:30', '2027-01-01T00:00',
    ]);
    expect(field('kozepMin').value).toBe('90.5');
    submit();
    expect(emitted).toEqual([{
      slug: 'osz-2026', title: 'Őszi', registrationOpensAt: toBudapestInput(EVENT.registrationOpensAt), opensAt: '2026-03-29T03:30',
      startClosesAt: '2026-10-25T02:30', resultsPlannedAt: '2026-10-25T02:30', practiceReleaseAt: '2027-01-01T00:00',
      kozepTaskSetId: 1, emeltTaskSetId: 2, kozepTimeLimitSeconds: 5430, emeltTimeLimitSeconds: 14400, totalBudgetUsd: 500, badgeKeyPrefix: 'MOCK_1',
    }]);
    expect(danger).not.toHaveBeenCalled();
  });

  it('új esemény: alapértékek az első két sorral; kevés sornál 0; a beírt budapesti idő változatlanul megy ki', () => {
    render({ event: null }, [OPTIONS[0]]);
    const form = fixture.componentInstance.form();
    expect(form.getRawValue()).toEqual({
      title: '', slug: '', registrationOpensAt: '', opensAt: '', startClosesAt: '', resultsPlannedAt: '', practiceReleaseAt: '',
      kozepTaskSetId: 5, emeltTaskSetId: 0, kozepMinutes: 180, emeltMinutes: 240, totalBudgetUsd: 500, badgeKeyPrefix: null,
    });
    form.patchValue({ title: 'T', slug: 'abc', registrationOpensAt: '2026-10-25T02:30', opensAt: '2026-10-26T08:00', startClosesAt: '2026-10-27T08:00',
      resultsPlannedAt: '2026-10-28T08:00', practiceReleaseAt: '2026-10-29T08:00', badgeKeyPrefix: '' });
    type('emeltMin', '45');
    submit();
    expect(emitted[0]).toMatchObject({ registrationOpensAt: '2026-10-25T02:30', emeltTimeLimitSeconds: 2700, badgeKeyPrefix: null });
  });

  it('érvénytelennél nem küld, magyar üzenet; új cél alapállapotba tölti, a sorok változása nem', () => {
    render({ event: EVENT });
    type('title', '');
    submit();
    expect(emitted).toEqual([]);
    expect(danger).toHaveBeenCalledWith(expect.stringContaining('Gyakorlóként felszabadul'));

    type('title', 'Átírva');
    fixture.componentRef.setInput('options', [...OPTIONS, { id: 9, title: 'C', level: null }]);
    fixture.detectChanges();
    expect(field('title').value).toBe('Átírva');

    fixture.componentRef.setInput('target', { event: EVENT });
    fixture.detectChanges();
    expect(field('title').value).toBe('Őszi');
  });
});

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminErettsegiEredmenyekComponent } from './admin-erettsegi-eredmenyek.component';
import { AdminGrowthService } from '../../services/admin/admin-growth.service';
import { ExamOutcomeSummary } from '../../models/exam-outcomes.model';

const summary: ExamOutcomeSummary = {
  year: 2027, years: [2027], responses: 9, notTaken: 1, fromParents: 2, usable: 7, pendingQuotes: 1,
  levels: [
    { level: 'kozep', count: 4, averagePercent: 71.5, grades: [0, 0, 1, 2, 1], segments: [{ label: '4 hétnél kevesebb', count: 1, averagePercent: 60 }] },
    { level: 'emelt', count: 3, averagePercent: 58, grades: [0, 1, 1, 1, 0], segments: [] },
  ],
  accuracy: { count: 5, meanAbsoluteError: 6.2, withinBandShare: 0.6, meanSignedError: 1.4 },
};

describe('AdminErettsegiEredmenyekComponent (Érettségi-eredmények)', () => {
  function setup() {
    const api = {
      getOutcomeSummary: vi.fn(() => of(summary)),
      getQuotes: vi.fn(() => of([{ id: 3, year: 2027, level: 'emelt', percent: 68, grade: 4, quote: 'Megérte!', status: 'pending', updatedAt: '2027-07-01T10:00:00' }])),
      setQuoteStatus: vi.fn(() => of({})),
      exportCsv: vi.fn(),
    };
    TestBed.configureTestingModule({ imports: [AdminErettsegiEredmenyekComponent], providers: [{ provide: AdminGrowthService, useValue: api }] });
    const fixture = TestBed.createComponent(AdminErettsegiEredmenyekComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, api };
  }

  it('összesítő szintenként, kis minta figyelmeztetés, pontosság', () => {
    const { el } = setup();
    expect(el.querySelector('[data-testid="level-kozep"]')?.textContent).toMatch(/átlag 71[.,]5%/); // a teszt-környezet nem magyar locale-lal fut
    expect(el.querySelector('[data-testid="small-sample"]')?.textContent).toContain('Még csak 7 eredmény');
    expect(el.querySelector('[data-testid="accuracy"]')?.textContent).toMatch(/6[.,]2 százalékpont/);
    expect(el.querySelector('[data-testid="accuracy"]')?.textContent).toContain('60%');
  });

  it('idézet jóváhagyása: a lista frissül', () => {
    const { fixture, el, api } = setup();
    expect(el.querySelector('[data-testid="quotes"]')?.textContent).toContain('Megérte!');
    [...el.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Jóváhagyom')!.click();
    fixture.detectChanges();
    expect(api.setQuoteStatus).toHaveBeenCalledWith(3, true);
    expect(el.querySelector('[data-testid="quotes"]')?.textContent).toContain('Nincs ilyen idézet.');
  });
});

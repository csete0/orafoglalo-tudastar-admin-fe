import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminSzempontlistakComponent, toBlocks } from './admin-szempontlistak.component';
import { AdminRubricsService } from '../../services/admin/admin-rubrics.service';
import { RubricDetail, RubricItem } from '../../models/rubrics.model';

const item = (order: number, kind: RubricItem['kind'], text: string, points = 0, groupNo: number | null = null, minCorrect: number | null = null,
  section = 'A körcikkek'): RubricItem => ({ id: order, order, section, text, kind, points, groupNo, minCorrect, checkMode: null });

const detail = (over: Partial<RubricDetail> = {}): RubricDetail => ({
  id: 9, taskId: 90, setTitle: '2024. május-június', levelId: 3, taskType: 'word', taskTitle: 'Danuvia', taskMaxPoints: 3,
  version: 1, status: 'draft', source: 'official-xlsx', sourceRef: null, rawTotal: 3, examPoints: 3, note: null, reviewedAt: null,
  itemPointSum: 3, problems: [],
  items: [
    item(1, 'criterion', 'Létezik a fájl', 1, null, null, 'A fájl'),
    item(2, 'statement', 'Első állítás', 0, 1), item(3, 'statement', 'Második állítás', 0, 1),
    item(4, 'threshold', 'A fentiek közül legalább kettő helyes', 1, 1, 2), item(5, 'threshold', 'A fentiek mindegyike helyes', 1, 1, 2),
  ],
  ...over,
});

describe('AdminSzempontlistakComponent (Szempontlisták)', () => {
  function setup(review = vi.fn(() => of(detail({ status: 'approved' })))) {
    const api = {
      listOfficial: vi.fn(() => of([
        { taskId: 90, setTitle: '2024. május-június', levelId: 3, taskType: 'word', taskTitle: 'Danuvia', taskMaxPoints: 3, rubricId: 9, version: 1, status: 'draft', itemCount: 5, hasApproved: false },
        { taskId: 91, setTitle: '2024. május-június', levelId: 3, taskType: 'sql', taskTitle: 'Ingatlan', taskMaxPoints: 35, rubricId: 10, version: 1, status: 'approved', itemCount: 30, hasApproved: true },
      ])),
      get: vi.fn(() => of(detail())),
      review,
    };
    TestBed.configureTestingModule({ imports: [AdminSzempontlistakComponent], providers: [{ provide: AdminRubricsService, useValue: api }] });
    const fixture = TestBed.createComponent(AdminSzempontlistakComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, api };
  }

  it('a csoportok blokkokba rendeződnek: állítások + küszöbök', () => {
    const blocks = toBlocks(detail().items);
    expect(blocks.map((b) => b.kind)).toEqual(['criterion', 'group']);
    expect(blocks[1].statements!.length).toBe(2);
    expect(blocks[1].thresholds!.map((t) => t.minCorrect)).toEqual([2, 2]);
  });

  it('lista haladással, részletek, jóváhagyás → a sor állapota frissül; csak a várakozók szűrő', () => {
    const { fixture, el, api } = setup();
    expect(el.querySelector('[data-testid="rubric-progress"]')?.textContent).toContain('1 / 2');
    el.querySelector<HTMLButtonElement>('[data-testid="rubric-row-90"]')!.click();
    fixture.detectChanges();
    expect(api.get).toHaveBeenCalledWith(9);
    expect(el.querySelector('[data-testid="rubric-totals"]')?.textContent).toContain('3');
    expect(el.querySelectorAll('[data-testid="rubric-group"] li').length).toBe(2);
    [...el.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Jóváhagyom')!.click();
    fixture.detectChanges();
    expect(api.review).toHaveBeenCalledWith(9, true, null);
    expect(el.querySelector('[data-testid="rubric-progress"]')?.textContent).toContain('2 / 2');
    (el.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="rubric-list"]')?.textContent).toContain('Nincs jóváhagyásra váró');
  });

  it('hibás listánál a jóváhagyás tiltott, elutasítás csak megjegyzéssel; a szerver hibaüzenete megjelenik', () => {
    const review = vi.fn(() => throwError(() => ({ error: { errorMessage: 'Csak vázlat vagy elutasított szempontlista bírálható el.' } })));
    const { fixture, el, api } = setup(review);
    api.get.mockReturnValueOnce(of(detail({ problems: ['A szempontok pontösszege (2) nem egyezik a nyers összponttal (3).'] })));
    el.querySelector<HTMLButtonElement>('[data-testid="rubric-row-90"]')!.click();
    fixture.detectChanges();
    const button = (label: string) => [...el.querySelectorAll('button')].find((b) => b.textContent!.trim() === label) as HTMLButtonElement;
    expect(button('Jóváhagyom').disabled).toBe(true);
    expect(button('Elutasítom').disabled).toBe(true);
    const box = el.querySelector('textarea')!;
    box.value = 'Hiányzik egy szempont';
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('Elutasítom').click();
    fixture.detectChanges();
    expect(review).toHaveBeenCalledWith(9, false, 'Hiányzik egy szempont');
    expect(el.textContent).toContain('Csak vázlat vagy elutasított');
  });
});

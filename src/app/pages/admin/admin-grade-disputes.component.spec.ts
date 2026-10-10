import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminGradeDisputesComponent } from './admin-grade-disputes.component';
import { AdminGradeDisputeService } from '../../services/admin/admin-grade-dispute.service';
import { ToastService } from '../../shared/toast/toast.service';
import { GradeDispute } from '../../models/grade-dispute.model';

const dispute = (overrides: Partial<GradeDispute> = {}): GradeDispute => ({
  id: 3, createdAt: '2026-10-03T08:00:00', reason: 'A margó 2 cm volt.', studentName: 'Kiss Anna', studentEmail: 'anna@example.com',
  taskId: 93, taskTitle: 'Dokumentumkészítés', taskSetTitle: '2024. május-június', examSessionId: 2442,
  rubricStatus: 'draft', model: 'google/gemini-2.5-flash', rawPoints: 28, rawTotal: 35, summary: 'Jó munka.',
  items: [
    { itemId: 1, order: 1, section: null, text: 'A margó 2 cm', kind: 'criterion', maxPoints: 2, points: 1, ok: null, reason: '1,5 cm', groupNo: null },
    { itemId: 2, order: 2, section: null, text: 'A cím középen', kind: 'statement', maxPoints: 0, points: 0, ok: true, reason: null, groupNo: 1 },
  ],
  files: [{ id: 'f1', name: 'danuvia.docx', sizeBytes: 83007 }],
  resolvedAt: null, resolution: null, disputedItemIds: [],
  ...overrides,
});

/** „Szerintem hibás az értékelés” várólista (PATRICKS-TELJES-VIZSGA-TERV.md, H4). */
describe('AdminGradeDisputesComponent', () => {
  let svc: { list: ReturnType<typeof vi.fn>; resolve: ReturnType<typeof vi.fn>; file: ReturnType<typeof vi.fn> };

  function render() {
    TestBed.configureTestingModule({
      imports: [AdminGradeDisputesComponent],
      providers: [
        { provide: AdminGradeDisputeService, useValue: svc },
        { provide: ToastService, useValue: { success: vi.fn(), danger: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(AdminGradeDisputesComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    svc = { list: vi.fn(() => of({ items: [dispute()], totalCount: 1 })), resolve: vi.fn(() => of({})), file: vi.fn(() => of(new Blob(['x']))) };
  });

  it('a kifogást a diák indokával, a fájllal és csak a pontot vesztett szempontokkal mutatja', () => {
    const el: HTMLElement = render().nativeElement;
    const row = el.querySelector('[data-testid="grade-dispute-row"]')!;
    expect(svc.list).toHaveBeenCalledWith(true, 1, 20, null);
    expect(row.textContent).toContain('A margó 2 cm volt.');
    expect(row.textContent).toContain('vizsga #2442');
    expect(row.textContent).toContain('danuvia.docx (81 KB)');
    expect(row.textContent).toContain('Pontot vesztett szempontok (1 / 2)');
    expect(row.textContent).toContain('1,5 cm');
    expect(row.textContent).not.toContain('A cím középen');
  });

  it('tételenkénti javítás: csak a megváltozott tétel megy el', () => {
    const fixture = render();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="grade-corrections"]')?.textContent).toContain('A margó 2 cm');
    const d = dispute();
    fixture.componentInstance.setCorrection(d, d.items[0], 2, null);
    fixture.componentInstance.resolve(d);
    expect(svc.resolve).toHaveBeenCalledWith(3, null, [{ itemId: 1, points: 2, ok: null }]);
  });

  it('ha a diák tételeket jelölt, azok javíthatók', () => {
    const d = dispute({ disputedItemIds: [2] });
    const fixture = render();
    expect(fixture.componentInstance.correctable(d).map(i => i.itemId)).toEqual([2]);
  });

  it('lezáráskor a választ elküldi és újratölt', () => {
    const fixture = render();
    fixture.componentInstance.answers[3] = '  Igazad van.  ';
    fixture.componentInstance.resolve(dispute());
    expect(svc.resolve).toHaveBeenCalledWith(3, 'Igazad van.', []);
    expect(svc.list).toHaveBeenCalledTimes(2);
  });

  // PATRICKS-GYAKORLO-ERTEKELES-TERV.md, 6b: a gyakorló kód-értékelés kifogásai is ide jönnek, fajta szerint szűrhetők.
  it('a fajta-szűrő a kind paraméterrel, az első oldalról tölt újra, és a kód-kifogást jelöli', () => {
    svc.list.mockReturnValue(of({ items: [dispute({ kind: 'code', examSessionId: null })], totalCount: 1 }));
    const fixture = render();
    const el: HTMLElement = fixture.nativeElement;
    const codeButton = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Kód / SQL')!;
    codeButton.click();
    fixture.detectChanges();

    expect(svc.list).toHaveBeenLastCalledWith(true, 1, 20, 'code');
    expect(el.querySelector('[data-testid="grade-dispute-row"]')!.textContent).toContain('gyakorlás (kód/SQL)');
  });
});

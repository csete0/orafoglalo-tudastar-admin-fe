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
  resolvedAt: null, resolution: null,
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
    expect(svc.list).toHaveBeenCalledWith(true, 1, 20);
    expect(row.textContent).toContain('A margó 2 cm volt.');
    expect(row.textContent).toContain('vizsga #2442');
    expect(row.textContent).toContain('danuvia.docx (81 KB)');
    expect(row.textContent).toContain('Pontot vesztett szempontok (1 / 2)');
    expect(row.textContent).toContain('1,5 cm');
    expect(row.textContent).not.toContain('A cím középen');
  });

  it('lezáráskor a választ elküldi és újratölt', () => {
    const fixture = render();
    fixture.componentInstance.answers[3] = '  Igazad van.  ';
    fixture.componentInstance.resolve(dispute());
    expect(svc.resolve).toHaveBeenCalledWith(3, 'Igazad van.');
    expect(svc.list).toHaveBeenCalledTimes(2);
  });
});

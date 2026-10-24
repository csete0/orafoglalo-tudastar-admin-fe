import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AdminMockExam } from '../../../models/mock-exam.model';

/**
 * Az események gombsora (a kiválasztott kiemelve, a rejtettek jelölve) és az „+ Új esemény” gomb:
 * `<div app-mock-exam-list class="flex …" [events]="…" [selectedId]="…" (chosen)="…" (create)="…">`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'div[app-mock-exam-list]',
  template: `
    @for (e of events(); track e.id) {
      <button type="button" class="btn" [class.btn-primary]="selectedId() === e.id" [class.btn-ghost]="selectedId() !== e.id" (click)="chosen.emit(e)">
        {{ e.title }} @if (!e.isPublished) { <span class="badge badge-neutral ml-1">rejtett</span> }
      </button>
    }
    <button type="button" class="btn btn-ghost" (click)="create.emit()" data-testid="mock-new">+ Új esemény</button>
  `,
})
export class MockExamListComponent {
  readonly events = input.required<AdminMockExam[]>();
  readonly selectedId = input<number | null>(null);
  readonly chosen = output<AdminMockExam>();
  readonly create = output<void>();
}

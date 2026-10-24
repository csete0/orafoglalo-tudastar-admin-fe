import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocalSpinnerComponent } from '../../../shared/local-spinner/local-spinner.component';
import { PagerComponent } from '../../../shared/pager/pager.component';
import { InquiriesState } from './inquiries.state';

/**
 * Ellenőrzés oldal, Érdeklődések fül (intézményi érdeklődések): szűrő, lista a „Kezelve jelölés” művelettel és
 * megjegyzéssel, lapozó. Az állapot az `InquiriesState`-ben (oldal-szintű).
 * A gazda-elem `display: contents`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-inquiries-tab',
  imports: [DatePipe, FormsModule, LocalSpinnerComponent, PagerComponent],
  styles: ':host { display: contents; }',
  template: `
    <div class="flex gap-2 mb-6 text-sm flex-wrap">
      @for (option of filterOptions; track option.value) {
        <button (click)="state.setOnlyOpen(option.value)"
          class="px-3 py-1.5 rounded-lg border font-semibold transition-colors"
          [class.bg-primary]="state.query().onlyOpen === option.value"
          [class.text-white]="state.query().onlyOpen === option.value"
          [class.border-primary]="state.query().onlyOpen === option.value"
          [class.border-border-default]="state.query().onlyOpen !== option.value"
          [class.text-text-muted]="state.query().onlyOpen !== option.value">
          {{ option.label }}
        </button>
      }
    </div>

    @if (state.error()) {
      <p class="text-danger text-sm mb-4">{{ state.error() }}</p>
    }
    @if (state.loading()) {
      <app-local-spinner />
    } @else {
      <ul class="space-y-3">
        @for (inq of state.inquiries(); track inq.id) {
          <li class="card p-4">
            <div class="flex justify-between items-start gap-3 mb-1">
              <div class="min-w-0">
                <p class="font-semibold text-sm truncate">{{ inq.schoolName }}</p>
                <p class="text-xs text-text-muted mt-0.5">
                  {{ inq.contactName }} · {{ inq.email }}
                  @if (inq.phone) { · {{ inq.phone }} }
                  @if (inq.estimatedStudents) { · ~{{ inq.estimatedStudents }} fő }
                </p>
              </div>
              <span class="text-xs text-text-muted shrink-0">{{ inq.createdAt | date: 'yyyy.MM.dd' }}</span>
            </div>
            @if (inq.message) {
              <p class="text-sm my-2 break-words border-l-2 border-border-default pl-2 text-text-muted italic">
                „{{ inq.message }}"
              </p>
            }
            @if (inq.isHandled) {
              <span class="badge badge-success text-xs">Kezelve {{ inq.handledAt | date: 'yyyy.MM.dd' }}</span>
              @if (inq.note) {
                <p class="text-xs text-text-muted mt-1 italic">Megjegyzés: {{ inq.note }}</p>
              }
            } @else {
              <div class="mt-2 space-y-2">
                <input [(ngModel)]="state.handledNotes[inq.id]" placeholder="Megjegyzés (opcionális)"
                  class="input !py-1.5 !text-xs" maxlength="500" />
                <button (click)="state.markHandled(inq)" [disabled]="state.pending()"
                  class="btn btn-primary !px-3 !py-1.5 !text-xs">
                  Kezelve jelölés
                </button>
              </div>
            }
          </li>
        } @empty {
          <li class="text-text-muted text-sm py-6 text-center">
            {{ state.query().onlyOpen ? 'Nincs kezeletlen érdeklődés.' : 'Nincs egyetlen érdeklődés sem.' }}
          </li>
        }
      </ul>

      @if (state.totalCount() > state.pageSize) {
        <div class="flex items-center gap-4 mt-6 text-sm" app-pager variant="ghost" [page]="state.query().page"
          [pageSize]="state.pageSize" [total]="state.totalCount()" (pageChange)="state.setPage($event)"></div>
      }
    }
  `,
})
export class InquiriesTabComponent {
  protected readonly state = inject(InquiriesState);

  protected readonly filterOptions = [
    { value: true, label: 'Csak nyitottak' },
    { value: false, label: 'Összes' },
  ];
}

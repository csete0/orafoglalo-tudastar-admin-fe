import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AdminSchoolStore } from '../../../services/admin/admin-school.store';
import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { schoolLabel } from './school-label';

/** Két duplikált intézmény egyesítése: `<div app-school-merge-panel class="card …">`. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'div[app-school-merge-panel]',
  imports: [ReactiveFormsModule],
  template: `
    <h2 class="font-bold mb-3">Intézmények egyesítése</h2>
    <p class="text-sm text-text-muted mb-3">
      Két véletlenül duplikáltan létrejött intézmény egyesíthető: a forrás összes tanára és csoportja
      átkerül a célba, a forrás intézmény törlődik.
    </p>
    <div class="flex gap-3 items-end flex-wrap" [formGroup]="form">
      <div class="min-w-0 max-w-full">
        <label class="text-xs text-text-muted block mb-1">Forrás (törlődik)</label>
        <select formControlName="sourceId" name="sourceId" class="input !w-auto min-w-48 max-w-full">
          <option [ngValue]="null">Válassz…</option>
          @for (school of store.schools(); track school.id) {
            <option [ngValue]="school.id">{{ schoolLabel(school) }}</option>
          }
        </select>
      </div>
      <div class="min-w-0 max-w-full">
        <label class="text-xs text-text-muted block mb-1">Cél (megmarad)</label>
        <select formControlName="targetId" name="targetId" class="input !w-auto min-w-48 max-w-full">
          <option [ngValue]="null">Válassz…</option>
          @for (school of store.schools(); track school.id) {
            <option [ngValue]="school.id">{{ schoolLabel(school) }}</option>
          }
        </select>
      </div>
      <button (click)="confirmMerge()" [disabled]="!canMerge() || store.loading()" class="btn btn-primary !px-3 !py-1.5">
        Egyesítés
      </button>
    </div>
  `,
})
export class SchoolMergePanelComponent {
  readonly store = inject(AdminSchoolStore);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly form = this.fb.group({
    sourceId: this.fb.control<number | null>(null),
    targetId: this.fb.control<number | null>(null),
  });
  readonly schoolLabel = schoolLabel;

  // A forrás és a cél is ki van választva, és nem ugyanaz: ez az EGYETLEN kliens-oldali védelem a
  // visszavonhatatlan (forrás-törléssel járó) művelet előtt.
  canMerge(): boolean {
    const { sourceId, targetId } = this.form.getRawValue();
    return sourceId !== null && targetId !== null && sourceId !== targetId;
  }

  async confirmMerge(): Promise<void> {
    const { sourceId, targetId } = this.form.getRawValue();
    if (!this.canMerge() || sourceId === null || targetId === null || this.store.loading()) return;

    const source = this.store.schools().find((s) => s.id === sourceId);
    const target = this.store.schools().find((s) => s.id === targetId);
    if (!source || !target) return;

    const sourceLabel = schoolLabel(source);
    const targetLabel = schoolLabel(target);
    const ok = await this.confirmService.ask({
      message:
        `Biztosan egyesíted a(z) „${sourceLabel}” intézményt a(z) „${targetLabel}” intézménybe? ` +
        `Minden tanára és csoportja átkerül, a(z) „${sourceLabel}” törlődik. Ez nem vonható vissza.`,
      danger: true,
      confirmLabel: 'Egyesítés',
    });
    if (!ok) return;

    // Siker-visszajelzés itt nem toast: az oldal lastMergeResult panelje részletes
    // összegzést ad (átkerült csoportok/tagságok száma).
    this.store.merge(sourceId, targetId);
    this.form.reset();
  }
}

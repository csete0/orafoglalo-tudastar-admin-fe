import { ChangeDetectionStrategy, Component, computed, inject, input, output, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ToastService } from '../../../shared/toast/toast.service';
import { AdminMockExam, AdminMockExamTaskSetOption, AdminMockExamUpsert, toBudapestInput } from '../../../models/mock-exam.model';

/** Mit szerkeszt az űrlap: új eseményt (`event: null`) vagy egy meglévőt. Minden új objektum alapállapotba tölti az űrlapot. */
export interface MockExamFormTarget { event: AdminMockExam | null }

/**
 * Próbaérettségi létrehozása/módosítása. A határon konvertál: a meglévő esemény UTC-időpontjai budapesti „yyyy-MM-ddTHH:mm”
 * értékként kerülnek a mezőkbe (a szerver budapestiként olvassa vissza), az időkeret percben látszik, másodpercben megy ki.
 * Az érvényesség a sablon attribútumaiból jön (required, pattern, maxlength, min/max) - mint eddig.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-mock-exam-form',
  imports: [ReactiveFormsModule],
  styles: ':host { display: contents; }',
  template: `
    <form [formGroup]="form()" class="card p-5 mb-6 grid gap-3 md:grid-cols-2" (ngSubmit)="submit()" data-testid="mock-form">
      <h2 class="font-bold md:col-span-2">{{ target().event ? 'Esemény módosítása' : 'Új esemény' }}</h2>
      @if (hasSessions()) {
        <p class="text-xs text-warning md:col-span-2">Már elindult: csak a cím, az eredmény és a gyakorló időpontja módosítható. A keretet a „Keret emelése” gombbal.</p>
      }
      <label class="text-sm">Cím<input class="input" name="title" formControlName="title" required maxlength="120" /></label>
      <label class="text-sm">Azonosító (slug)<input class="input" name="slug" formControlName="slug" required pattern="[a-z0-9-]{3,60}" /></label>
      <label class="text-sm">Jelentkezés nyílik<input class="input" type="datetime-local" name="reg" formControlName="registrationOpensAt" required /></label>
      <label class="text-sm">Kezdés nyílik<input class="input" type="datetime-local" name="opens" formControlName="opensAt" required /></label>
      <label class="text-sm">Kezdési határ<input class="input" type="datetime-local" name="closes" formControlName="startClosesAt" required /></label>
      <label class="text-sm">Eredmény közzététele<input class="input" type="datetime-local" name="results" formControlName="resultsPlannedAt" required /></label>
      <label class="text-sm">Gyakorlóként felszabadul<input class="input" type="datetime-local" name="practice" formControlName="practiceReleaseAt" required /></label>
      <label class="text-sm">MI-összkeret ($)<input class="input" type="number" min="0" step="1" name="budget" formControlName="totalBudgetUsd" /></label>
      <label class="text-sm">Középszint feladatsora
        <select class="input" name="kozep" formControlName="kozepTaskSetId">
          @for (o of options(); track o.id) { <option [ngValue]="o.id">#{{ o.id }} {{ o.title }}</option> }
        </select></label>
      <label class="text-sm">Emelt szint feladatsora
        <select class="input" name="emelt" formControlName="emeltTaskSetId">
          @for (o of options(); track o.id) { <option [ngValue]="o.id">#{{ o.id }} {{ o.title }}</option> }
        </select></label>
      <label class="text-sm">Közép időkeret (perc)<input class="input" type="number" min="10" max="300" name="kozepMin" formControlName="kozepMinutes" required /></label>
      <label class="text-sm">Emelt időkeret (perc)<input class="input" type="number" min="10" max="300" name="emeltMin" formControlName="emeltMinutes" required /></label>
      <label class="text-sm">Jelvény-előtag (pl. MOCKEXAM_2026OSZ)<input class="input" name="badge" formControlName="badgeKeyPrefix" pattern="[A-Z0-9_]{3,40}" /></label>
      <div class="md:col-span-2 flex gap-2 justify-end">
        <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">Mégse</button>
        <button type="submit" class="btn btn-primary" [disabled]="busy()">Mentés</button>
      </div>
    </form>
  `,
})
export class MockExamFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toast = inject(ToastService);

  readonly target = input.required<MockExamFormTarget>();
  /** A választható feladatsorok (módosításnál az esemény saját sorai is). Új eseménynél az első kettő az alapérték. */
  readonly options = input.required<AdminMockExamTaskSetOption[]>();
  /** Az esemény már elindult: csak tájékoztató sor, a mezők szerkeszthetők maradnak (a szerver dönt). */
  readonly hasSessions = input(false);
  readonly busy = input(false);
  readonly saved = output<AdminMockExamUpsert>();
  readonly cancelled = output<void>();

  /** Minden új cél új űrlapot ad (a nyitott űrlapon is alapállapot), a sorok listája ehhez nem változtat. */
  readonly form = computed(() => {
    const e = this.target().event;
    const options = untracked(this.options);
    return this.fb.group({
      title: e?.title ?? '',
      slug: e?.slug ?? '',
      registrationOpensAt: e ? toBudapestInput(e.registrationOpensAt) : '',
      opensAt: e ? toBudapestInput(e.opensAt) : '',
      startClosesAt: e ? toBudapestInput(e.startClosesAt) : '',
      resultsPlannedAt: e ? toBudapestInput(e.resultsPlannedAt) : '',
      practiceReleaseAt: e ? toBudapestInput(e.practiceReleaseAt) : '',
      kozepTaskSetId: e?.kozepTaskSetId ?? options[0]?.id ?? 0,
      emeltTaskSetId: e?.emeltTaskSetId ?? options[1]?.id ?? 0,
      kozepMinutes: (e?.kozepTimeLimitSeconds ?? 10800) / 60,
      emeltMinutes: (e?.emeltTimeLimitSeconds ?? 14400) / 60,
      totalBudgetUsd: e?.totalBudgetUsd ?? 500,
      badgeKeyPrefix: this.fb.control<string | null>(e?.badgeKeyPrefix ?? null),
    });
  });

  submit(): void {
    const form = this.form();
    // Üres időpontnál a szerver nyers, angol JSON-hibát adna - előbb itt, érthetően.
    if (!form.valid) {
      this.toast.danger('Tölts ki minden kötelező mezőt: a cím, az azonosító és mind az öt időpont (a „Gyakorlóként felszabadul” is) kötelező.');
      return;
    }
    const { kozepMinutes, emeltMinutes, badgeKeyPrefix, ...rest } = form.getRawValue();
    this.saved.emit({
      ...rest,
      kozepTimeLimitSeconds: kozepMinutes * 60,
      emeltTimeLimitSeconds: emeltMinutes * 60,
      badgeKeyPrefix: badgeKeyPrefix?.trim() || null,
    });
  }
}

import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminPracticeGradesService } from '../../services/admin/admin-practice-grades.service';
import { PRACTICE_KIND_LABELS, PracticeGradeUserDetail, PracticeGradeUserQuota } from '../../models/practice-grades.model';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { extractErrorMessage } from '../../shared/http-error/extract-error-message.util';

/** Kézi keret-jóváírás (support eset, pl. „+5 ma”), naplózva: `<div class="actions credit" app-user-practice-credit …>`. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'div[app-user-practice-credit]',
  imports: [ReactiveFormsModule],
  template: `
    <p class="credit-title">Kézi keret-jóváírás</p>
    <div class="credit-form" [formGroup]="form">
      <select formControlName="kind" aria-label="Típus">
        @for (q of quotas(); track q.kind) {
          <option [value]="q.kind">{{ kindLabels[q.kind] ?? q.kind }}</option>
        }
      </select>
      <input type="number" min="1" max="50" step="1" formControlName="amount" aria-label="Darab" />
      <input type="text" maxlength="300" formControlName="reason" placeholder="Indoklás (pl. support-jegy száma)" aria-label="Indoklás" />
      <div class="action-buttons">
        <button type="button" [disabled]="busy() || !isValid()" (click)="grantCredit()">Jóváírás</button>
      </div>
    </div>
    @if (message()) {
      <p class="action-message">{{ message() }}</p>
    }
  `,
  styleUrls: ['./user-detail-section.css', './user-practice-credit.component.css'],
})
export class UserPracticeCreditComponent implements OnInit {
  private readonly practiceGrades = inject(AdminPracticeGradesService);
  private readonly confirmService = inject(ConfirmService);

  readonly userId = input.required<number>();
  /** Legalább egy elem (a szülő csak ilyenkor jeleníti meg az űrlapot). */
  readonly quotas = input.required<readonly PracticeGradeUserQuota[]>();
  /** A sikeres jóváírás válasza: a diák frissített keret-állása. */
  readonly credited = output<PracticeGradeUserDetail>();
  readonly kindLabels = PRACTICE_KIND_LABELS;

  readonly form = inject(NonNullableFormBuilder).group({ kind: 'code', amount: 5, reason: '' });
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);

  ngOnInit(): void {
    // Ha a „Kód” típusnak nincs kerete, az első elérhető típus az alapértelmezett.
    const quotas = this.quotas();
    if (!quotas.some((q) => q.kind === this.form.controls.kind.value)) this.form.controls.kind.setValue(quotas[0].kind);
  }

  /** 1–50 közötti egész darab és nem üres indoklás kell (az indoklás az audit-naplóba kerül). */
  isValid(): boolean {
    const { amount, reason } = this.form.getRawValue();
    return Number.isInteger(amount) && amount >= 1 && amount <= 50 && reason.trim().length > 0;
  }

  async grantCredit(): Promise<void> {
    if (!this.isValid() || this.busy()) return;
    const { kind, amount, reason } = this.form.getRawValue();
    const ok = await this.confirmService.ask({
      title: 'Kézi keret-jóváírás',
      message: `+${amount} gyakorló értékelés (${this.kindLabels[kind] ?? kind}) a mai napi és az e havi keretre. A jóváírás az audit-naplóba kerül. Folytatod?`,
      confirmLabel: 'Jóváírás',
    });
    if (!ok) return;

    this.busy.set(true);
    this.message.set(null);
    try {
      this.credited.emit(await firstValueFrom(this.practiceGrades.credit(this.userId(), { kind, amount, reason: reason.trim() })));
      this.form.controls.reason.setValue('');
      this.message.set('Keret jóváírva.');
    } catch (err) {
      this.message.set(extractErrorMessage(err, 'A jóváírás sikertelen.'));
    } finally {
      this.busy.set(false);
    }
  }
}

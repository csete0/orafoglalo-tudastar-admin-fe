import { ChangeDetectionStrategy, Component, inject, input, model, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AdminCouponService } from '../../../services/admin/admin-coupon.service';
import { CouponAdminDto, CouponCreateRequest, SubscriptionTypeOption } from '../../../models/coupon.model';
import { ToastService } from '../../../shared/toast/toast.service';
import { extractErrorMessage } from '../../../shared/http-error/extract-error-message.util';

type DiscountKind = 'percent' | 'amount';

/**
 * Kuponok oldal: az „Új kupon” űrlap. A kedvezmény két formája - százalék VAGY fix Ft - közül pontosan az egyik megy el;
 * a validáció a szerveren fut, a hibaüzenetét az űrlap alatt mutatjuk. A létrehozott kupont a `created` adja vissza.
 * A `pending` az oldallal közös (létrehozás és inaktiválás közben minden gomb tiltva). A gazda-elem `display: contents`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-coupon-create-form',
  imports: [ReactiveFormsModule],
  styles: ':host { display: contents; }',
  template: `
    <form [formGroup]="form" (ngSubmit)="create()" class="card p-5 mb-6" novalidate>
      <h2 class="font-bold mb-3">Új kupon</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="sm:col-span-2">
          <label class="text-xs text-text-muted block mb-1" for="code">Kód</label>
          <input id="code" name="code" formControlName="code" class="input font-mono uppercase"
            maxlength="32" placeholder="pl. ISKOLA2026" autocomplete="off" required />
          <p class="text-xs text-text-muted mt-1">Csak betű és szám, max. 32 karakter - a rendszer nagybetűsíti.</p>
        </div>

        <div>
          <label class="text-xs text-text-muted block mb-1">Kedvezmény típusa</label>
          <div class="flex gap-2 text-sm">
            <button type="button" (click)="setKind('percent')"
              class="px-3 py-1.5 rounded-lg border font-semibold transition-colors"
              [class.bg-primary]="kind() === 'percent'" [class.text-white]="kind() === 'percent'"
              [class.border-primary]="kind() === 'percent'"
              [class.border-border-default]="kind() !== 'percent'" [class.text-text-muted]="kind() !== 'percent'">
              Százalék
            </button>
            <button type="button" (click)="setKind('amount')"
              class="px-3 py-1.5 rounded-lg border font-semibold transition-colors"
              [class.bg-primary]="kind() === 'amount'" [class.text-white]="kind() === 'amount'"
              [class.border-primary]="kind() === 'amount'"
              [class.border-border-default]="kind() !== 'amount'" [class.text-text-muted]="kind() !== 'amount'">
              Fix összeg (Ft)
            </button>
          </div>
        </div>
        <div>
          @if (kind() === 'percent') {
            <label class="text-xs text-text-muted block mb-1" for="percentOff">Kedvezmény (%)</label>
            <input id="percentOff" type="number" min="1" max="100" name="percentOff" formControlName="percentOff"
              class="input" placeholder="1–100" />
          } @else {
            <label class="text-xs text-text-muted block mb-1" for="amountOffHuf">Kedvezmény (Ft)</label>
            <input id="amountOffHuf" type="number" min="1" name="amountOffHuf" formControlName="amountOffHuf"
              class="input" placeholder="pl. 1000" />
          }
        </div>

        <div>
          <label class="text-xs text-text-muted block mb-1" for="validFrom">Érvényes ettől</label>
          <input id="validFrom" type="date" name="validFrom" formControlName="validFrom" class="input" />
          <p class="text-xs text-text-muted mt-1">Üresen: azonnal.</p>
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1" for="validTo">Érvényes eddig</label>
          <input id="validTo" type="date" name="validTo" formControlName="validTo" class="input" />
          <p class="text-xs text-text-muted mt-1">Üresen: nincs lejárat.</p>
        </div>

        <div>
          <label class="text-xs text-text-muted block mb-1" for="maxRedemptions">Beváltási limit</label>
          <input id="maxRedemptions" type="number" min="1" name="maxRedemptions" formControlName="maxRedemptions"
            class="input" placeholder="Üresen: korlátlan" />
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1" for="subscriptionTypeId">Csomag</label>
          <select id="subscriptionTypeId" name="subscriptionTypeId" formControlName="subscriptionTypeId" class="input">
            <option [ngValue]="null">Bármelyik fizetős csomag</option>
            @for (type of subscriptionTypes(); track type.id) {
              <option [ngValue]="type.id">{{ typeLabel(type) }}</option>
            }
          </select>
        </div>

        <div class="sm:col-span-2">
          <label class="text-xs text-text-muted block mb-1" for="note">Megjegyzés (belső)</label>
          <input id="note" name="note" formControlName="note" class="input" maxlength="200"
            placeholder="pl. Teszt Gimnázium szülői est 2026 ősz" />
        </div>
      </div>

      @if (formError()) {
        <p class="text-danger text-sm mt-3" role="alert">{{ formError() }}</p>
      }

      <div class="flex justify-end mt-4">
        <button type="submit" [disabled]="pending() || !canSubmit()" class="btn btn-primary !px-4 !py-2">
          Kupon létrehozása
        </button>
      </div>
    </form>
  `,
})
export class CouponCreateFormComponent {
  private readonly svc = inject(AdminCouponService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** A választható (fizetős) csomagok. */
  readonly subscriptionTypes = input.required<SubscriptionTypeOption[]>();
  /** Az oldallal közös foglaltság-jelző. */
  readonly pending = model.required<boolean>();
  readonly created = output<CouponAdminDto>();

  readonly kind = signal<DiscountKind>('percent');
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.group({
    code: '',
    percentOff: this.fb.control<number | null>(null),
    amountOffHuf: this.fb.control<number | null>(null),
    validFrom: '',
    validTo: '',
    maxRedemptions: this.fb.control<number | null>(null),
    subscriptionTypeId: this.fb.control<number | null>(null),
    note: '',
  });

  /** A típusváltás a másik kedvezmény-mezőt üríti (csak a választott megy el). */
  setKind(kind: DiscountKind): void {
    this.kind.set(kind);
    if (kind === 'percent') this.form.controls.amountOffHuf.setValue(null);
    else this.form.controls.percentOff.setValue(null);
  }

  canSubmit(): boolean {
    const { code, percentOff, amountOffHuf } = this.form.getRawValue();
    const hasDiscount = this.kind() === 'percent' ? !!percentOff : !!amountOffHuf;
    return !!code.trim() && hasDiscount;
  }

  typeLabel(type: SubscriptionTypeOption): string {
    const cycle = type.billingCycle === 'yearly' ? 'éves' : type.billingCycle === 'monthly' ? 'havi' : type.billingCycle;
    return `${type.name} (${cycle}, ${type.price.toLocaleString('hu-HU')} Ft)`;
  }

  create(): void {
    if (!this.canSubmit() || this.pending()) return;
    this.formError.set(null);
    this.pending.set(true);

    const value = this.form.getRawValue();
    const request: CouponCreateRequest = {
      code: value.code.trim(),
      percentOff: this.kind() === 'percent' ? value.percentOff : null,
      amountOffHuf: this.kind() === 'amount' ? value.amountOffHuf : null,
      // A <input type="date"> helyi naptári napot ad - a lejárat a nap VÉGÉIG él.
      validFrom: value.validFrom ? new Date(`${value.validFrom}T00:00:00`).toISOString() : null,
      validTo: value.validTo ? new Date(`${value.validTo}T23:59:59`).toISOString() : null,
      maxRedemptions: value.maxRedemptions || null,
      subscriptionTypeId: value.subscriptionTypeId,
      note: value.note.trim() || null,
    };

    this.svc.create(request).subscribe({
      next: (coupon) => {
        this.pending.set(false);
        this.created.emit(coupon);
        this.form.reset();
        this.toast.success(`Kupon létrehozva: ${coupon.code}`);
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.formError.set(extractErrorMessage(err, 'A kupon létrehozása sikertelen.'));
      },
    });
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { AdminCouponService } from '../../services/admin/admin-coupon.service';
import { CouponAdminDto } from '../../models/coupon.model';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';
import { ToastService } from '../../shared/toast/toast.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { extractErrorMessage } from '../../shared/http-error/extract-error-message.util';
import { latestValue } from '../../shared/resource/latest-value';
import { CouponCreateFormComponent } from './kuponok/coupon-create-form.component';

/**
 * B3: kuponkódok kezelése (platform-admin). A kedvezmény két formája - százalék VAGY fix
 * Ft - közül pontosan az egyiket kell megadni; a többi (érvényesség, limit, csomag) opcionális.
 * A validáció a szerveren fut (CouponService.CreateAsync), a hibaüzenetet változtatás nélkül
 * mutatjuk. Törlés nincs: a beváltott kuponhoz Payment-sor tartozik, ezért csak inaktiválás.
 * Az „Új kupon” űrlap a `CouponCreateFormComponent`-ben van.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-kuponok',
  imports: [DatePipe, LocalSpinnerComponent, CouponCreateFormComponent],
  template: `
    <div class="max-w-5xl">
      <h1 class="page-title">Kuponok</h1>
      <p class="text-sm text-text-muted mt-1">
        Kedvezménykódok az előfizetés-vásárláshoz. A diák a fizetési oldalon váltja be;
        a 100%-os kupon bankkártya nélkül aktivál.
      </p>
      <div class="hairline"></div>

      <app-coupon-create-form [subscriptionTypes]="subscriptionTypes()" [(pending)]="pending" (created)="onCreated($event)" />

      <div class="flex gap-2 mb-4 text-sm flex-wrap">
        @for (option of filterOptions; track option.value) {
          <button (click)="onlyActive.set(option.value)"
            class="px-3 py-1.5 rounded-lg border font-semibold transition-colors"
            [class.bg-primary]="onlyActive() === option.value"
            [class.text-white]="onlyActive() === option.value"
            [class.border-primary]="onlyActive() === option.value"
            [class.border-border-default]="onlyActive() !== option.value"
            [class.text-text-muted]="onlyActive() !== option.value">
            {{ option.label }}
          </button>
        }
      </div>

      @if (error()) {
        <p class="text-danger text-sm mb-4">{{ error() }}</p>
      }
      @if (loading()) {
        <app-local-spinner />
      }

      @if (!loading()) {
        <ul class="space-y-3">
          @for (coupon of visibleCoupons(); track coupon.id) {
            <li class="card p-4">
              <div class="flex justify-between items-start gap-3">
                <div class="min-w-0">
                  <p class="font-mono font-bold text-sm">
                    {{ coupon.code }}
                    @if (!coupon.isActive) {
                      <span class="badge badge-neutral text-xs ml-1">inaktív</span>
                    } @else if (isExhausted(coupon)) {
                      <span class="badge badge-warning text-xs ml-1">elfogyott</span>
                    } @else if (isExpired(coupon)) {
                      <span class="badge badge-warning text-xs ml-1">lejárt</span>
                    } @else {
                      <span class="badge badge-success text-xs ml-1">aktív</span>
                    }
                  </p>
                  <p class="text-xs text-text-muted mt-0.5">
                    {{ discountLabel(coupon) }} ·
                    {{ coupon.subscriptionTypeName || 'bármelyik fizetős csomag' }} ·
                    beváltva: {{ coupon.redemptionCount }}@if (coupon.maxRedemptions !== null) { / {{ coupon.maxRedemptions }}}
                  </p>
                  <p class="text-xs text-text-muted mt-0.5">
                    {{ coupon.validFrom | date: 'yyyy.MM.dd' }} –
                    {{ coupon.validTo ? (coupon.validTo | date: 'yyyy.MM.dd') : 'nincs lejárat' }}
                    @if (coupon.note) { · <span class="italic">{{ coupon.note }}</span> }
                  </p>
                </div>
                @if (coupon.isActive) {
                  <button (click)="deactivate(coupon)" [disabled]="pending()"
                    class="btn btn-ghost !px-3 !py-1.5 !text-xs shrink-0">
                    Inaktiválás
                  </button>
                }
              </div>
            </li>
          } @empty {
            <li class="text-text-muted text-sm py-6 text-center">
              {{ onlyActive() ? 'Nincs aktív kupon.' : 'Még nincs egyetlen kupon sem.' }}
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class AdminKuponokComponent {
  private readonly svc = inject(AdminCouponService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  private readonly couponsResource = rxResource({ stream: () => this.svc.list() });
  /** A betöltött lista; a létrehozás és az inaktiválás helyben frissíti. */
  private readonly latestCoupons = latestValue(this.couponsResource);
  readonly coupons = computed(() => this.latestCoupons() ?? []);
  readonly loading = this.couponsResource.isLoading;
  readonly error = computed(() => (this.couponsResource.error() ? 'A kuponok betöltése sikertelen.' : null));

  /** A `free` csomagra kupon nem adható (a szerver is elutasítja) - a listából kihagyjuk; hibánál üres. */
  readonly subscriptionTypes = toSignal(
    this.svc.subscriptionTypes().pipe(
      map((types) => types.filter((t) => t.price > 0)),
      catchError(() => of([])),
    ),
    { initialValue: [] },
  );

  readonly pending = signal(false);
  readonly onlyActive = signal(true);

  readonly filterOptions = [
    { value: true, label: 'Csak aktívak' },
    { value: false, label: 'Összes' },
  ];

  readonly visibleCoupons = computed(() =>
    this.onlyActive() ? this.coupons().filter((c) => c.isActive) : this.coupons(),
  );

  discountLabel(coupon: CouponAdminDto): string {
    if (coupon.percentOff !== null) return `${coupon.percentOff}% kedvezmény`;
    return `${(coupon.amountOffHuf ?? 0).toLocaleString('hu-HU')} Ft kedvezmény`;
  }

  isExhausted(coupon: CouponAdminDto): boolean {
    return coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions;
  }

  isExpired(coupon: CouponAdminDto): boolean {
    return !!coupon.validTo && new Date(coupon.validTo) < new Date();
  }

  onCreated(coupon: CouponAdminDto): void {
    this.latestCoupons.update((list) => [coupon, ...(list ?? [])]);
  }

  async deactivate(coupon: CouponAdminDto): Promise<void> {
    const ok = await this.confirmService.ask({
      message:
        `Inaktiválod a(z) ${coupon.code} kupont? Ezután nem váltható be többé - ` +
        'a korábbi beváltások és az általuk aktivált előfizetések változatlanok maradnak.',
      danger: true,
      confirmLabel: 'Inaktiválás',
    });
    if (!ok) return;

    this.pending.set(true);
    this.svc.deactivate(coupon.id).subscribe({
      next: (updated) => {
        this.pending.set(false);
        this.latestCoupons.update((list) => list?.map((c) => (c.id === updated.id ? updated : c)));
        this.toast.success('Kupon inaktiválva.');
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.toast.danger(extractErrorMessage(err, 'Hiba történt.'));
      },
    });
  }
}

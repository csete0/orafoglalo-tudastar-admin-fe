import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { GiftCouponService, GiftCouponListItem } from '../../services/gift-coupons/gift-coupon.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { PagerComponent } from '../../shared/pager/pager.component';
import { latestValue } from '../../shared/resource/latest-value';

const PAGE_SIZE = 50;

type YesNoFilter = 'all' | 'true' | 'false';

@Component({
  selector: 'app-gift-coupons',
  imports: [ReactiveFormsModule, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gift-coupons.component.html',
  styleUrls: ['../list-page.css', './gift-coupons.component.css'],
})
export class GiftCouponsComponent {
  private readonly giftCouponService = inject(GiftCouponService);
  private readonly confirmService = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly pageSize = PAGE_SIZE;
  /** A szűrő-mezők; csak a Szűrés gombbal lépnek érvénybe. */
  readonly form = this.fb.group({
    code: '',
    email: '',
    redeemedFilter: this.fb.control<YesNoFilter>('all'),
    activeFilter: this.fb.control<YesNoFilter>('all'),
  });
  private readonly filter = signal(this.form.getRawValue());
  readonly page = signal(1);

  private readonly result = rxResource({
    params: () => {
      const f = this.filter();
      return {
        code: f.code || undefined,
        email: f.email || undefined,
        redeemed: f.redeemedFilter === 'all' ? undefined : f.redeemedFilter === 'true',
        active: f.activeFilter === 'all' ? undefined : f.activeFilter === 'true',
        page: this.page(),
        pageSize: PAGE_SIZE,
      };
    },
    stream: ({ params }) => this.giftCouponService.getPage(params),
  });
  private readonly latest = latestValue(this.result);
  readonly items = computed(() => this.latest()?.items ?? []);
  readonly totalCount = computed(() => this.latest()?.totalCount ?? 0);
  readonly isLoading = this.result.isLoading;

  readonly busyId = signal<number | null>(null);
  readonly rowMessages = signal<Record<number, string>>({});

  search(): void {
    this.page.set(1);
    this.filter.set(this.form.getRawValue());
  }

  goToPage(page: number): void {
    if (page >= 1) this.page.set(page);
  }

  async resend(item: GiftCouponListItem): Promise<void> {
    this.busyId.set(item.id);
    try {
      const result = await firstValueFrom(this.giftCouponService.resend(item.id, true, true));
      const parts: string[] = [];
      if (result.sentToPurchaser) parts.push('vevőnek elküldve');
      if (result.sentToChild) parts.push('gyermeknek elküldve');
      this.setRowMessage(item.id, parts.length ? parts.join(', ') : 'Nem sikerült elküldeni.');
    } catch {
      this.setRowMessage(item.id, 'Hiba történt az újraküldés közben.');
    } finally {
      this.busyId.set(null);
    }
  }

  async deactivate(item: GiftCouponListItem): Promise<void> {
    // SEC-4 (terv, kétlépcsős megerősítés visszafordíthatatlan műveletre).
    const ok = await this.confirmService.ask({
      title: 'Ajándékkód érvénytelenítése',
      message: `Biztosan érvényteleníted a(z) ${item.code} ajándékkódot?`,
      confirmLabel: 'Érvénytelenítés',
      danger: true,
    });
    if (!ok) return;

    this.busyId.set(item.id);
    try {
      await firstValueFrom(this.giftCouponService.deactivate(item.id));
      // Újratöltés a mostani szűrővel és oldallal; közben a korábbi sorok látszanak.
      this.result.reload();
    } catch {
      this.setRowMessage(item.id, 'Hiba történt az érvénytelenítés közben.');
    } finally {
      this.busyId.set(null);
    }
  }

  private setRowMessage(id: number, message: string): void {
    this.rowMessages.update((m) => ({ ...m, [id]: message }));
  }
}

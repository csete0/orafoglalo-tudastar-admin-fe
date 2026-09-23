import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GiftCouponService, GiftCouponListItem } from '../../services/gift-coupons/gift-coupon.service';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-gift-coupons',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './gift-coupons.component.html',
  styleUrl: './gift-coupons.component.css',
})
export class GiftCouponsComponent implements OnInit {
  private readonly giftCouponService = inject(GiftCouponService);

  readonly items = signal<GiftCouponListItem[]>([]);
  readonly totalCount = signal(0);
  readonly page = signal(1);
  readonly isLoading = signal(false);
  readonly busyId = signal<number | null>(null);
  readonly rowMessages = signal<Record<number, string>>({});

  code = '';
  email = '';
  redeemedFilter: 'all' | 'true' | 'false' = 'all';
  activeFilter: 'all' | 'true' | 'false' = 'all';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async search(): Promise<void> {
    this.page.set(1);
    await this.load();
  }

  async goToPage(page: number): Promise<void> {
    if (page < 1) return;
    this.page.set(page);
    await this.load();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount() / PAGE_SIZE));
  }

  async resend(item: GiftCouponListItem): Promise<void> {
    this.busyId.set(item.id);
    try {
      const result = await this.giftCouponService.resend(item.id, true, true);
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
    if (!confirm(`Biztosan érvényteleníted a(z) ${item.code} ajándékkódot?`)) {
      return;
    }
    this.busyId.set(item.id);
    try {
      await this.giftCouponService.deactivate(item.id);
      await this.load();
    } catch {
      this.setRowMessage(item.id, 'Hiba történt az érvénytelenítés közben.');
    } finally {
      this.busyId.set(null);
    }
  }

  private setRowMessage(id: number, message: string): void {
    this.rowMessages.update((m) => ({ ...m, [id]: message }));
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    try {
      const result = await this.giftCouponService.getPage({
        code: this.code || undefined,
        email: this.email || undefined,
        redeemed: this.redeemedFilter === 'all' ? undefined : this.redeemedFilter === 'true',
        active: this.activeFilter === 'all' ? undefined : this.activeFilter === 'true',
        page: this.page(),
        pageSize: PAGE_SIZE,
      });
      this.items.set(result.items);
      this.totalCount.set(result.totalCount);
    } finally {
      this.isLoading.set(false);
    }
  }
}

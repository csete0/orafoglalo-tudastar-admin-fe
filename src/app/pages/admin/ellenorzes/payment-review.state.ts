import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminPaymentReviewService, NeedsReviewPaymentDto } from '../../../services/admin/admin-payment-review.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { latestValue } from '../../../shared/resource/latest-value';

/**
 * A Fizetések fül állapota (manuális felülvizsgálatot igénylő fizetések). Az oldal `providers`-ében él, így fülváltáskor
 * megmarad. Lusta: az oldal a fülre lépéskor hívja az `enter()`-t; ez az első alkalommal, utána pedig csak üres lista
 * esetén tölt (újra).
 */
@Injectable()
export class PaymentReviewState {
  private readonly svc = inject(AdminPaymentReviewService);
  private readonly toast = inject(ToastService);

  /** Hányadik betöltés (0: még nincs); minden `enter()`-beli betöltés új kulcs, így a korábbi hiba is azonnal eltűnik. */
  private readonly loadCount = signal(0);
  private readonly resource = rxResource({
    params: () => this.loadCount() || undefined,
    stream: () => this.svc.getNeedsReview(),
  });
  /** Betöltés közben és hiba után a korábbi lista marad; a műveletek helyben frissítik. */
  private readonly list = latestValue(this.resource);

  readonly payments = computed(() => this.list() ?? []);
  readonly loading = this.resource.isLoading;
  readonly error = computed(() => (this.resource.error() ? 'A fizetések betöltése sikertelen.' : null));
  readonly pending = signal(false);

  /** A fülre lépéskor: üres listánál (első alkalom, hiba vagy minden felülvizsgálva után) (újra)tölt. */
  enter(): void {
    if (this.payments().length === 0 && !this.loading()) this.loadCount.update((n) => n + 1);
  }

  markReviewDone(p: NeedsReviewPaymentDto): void {
    this.pending.set(true);
    this.svc.markReviewDone(p.id).subscribe({
      next: () => {
        this.pending.set(false);
        this.list.update((list) => list?.filter((x) => x.id !== p.id));
        this.toast.success('Felülvizsgálat kész jelölve.');
      },
      error: () => { this.pending.set(false); this.toast.danger('Hiba történt.'); },
    });
  }
}

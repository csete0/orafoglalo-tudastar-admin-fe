import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminAiSpendingService } from '../../../services/admin/admin-ai-spending.service';
import { AiRequestLogFilter } from '../../../models/ai-spending.model';
import { extractErrorMessage } from '../../../shared/http-error/extract-error-message.util';
import { latestValue } from '../../../shared/resource/latest-value';

/**
 * A Kérésnapló fül állapota. A pult `providers`-ében él, így fülváltáskor a szűrő, az oldal és a sorok megmaradnak.
 * Lusta: csak az első `start()` után tölt (a pult hívja, amikor a fül először megnyílik); utána minden szűrő- és
 * oldalváltás azonnal újratölt.
 */
@Injectable()
export class AiKoltesRequestLogState {
  private readonly svc = inject(AdminAiSpendingService);

  readonly pageSize = 20;
  private readonly started = signal(false);
  readonly filter = signal<AiRequestLogFilter>({});
  readonly page = signal(1);

  private readonly result = rxResource({
    params: () => (this.started() ? { filter: this.filter(), page: this.page() } : undefined),
    stream: ({ params }) => this.svc.getRequestLog(params.filter, params.page, this.pageSize),
  });
  /** Lapozás közben és hiba után a korábbi sorok maradnak. */
  private readonly lastPage = latestValue(this.result);

  readonly items = computed(() => this.lastPage()?.items ?? []);
  readonly totalCount = computed(() => this.lastPage()?.totalCount ?? 0);
  readonly loading = this.result.isLoading;
  readonly error = computed(() => {
    const err = this.result.error();
    return err ? extractErrorMessage(err, 'A kérésnapló betöltése sikertelen.') : null;
  });

  readonly hasNextPage = computed(() => this.page() * this.pageSize < this.totalCount());
  readonly rangeLabel = computed(() => {
    const total = this.totalCount();
    if (total === 0) return '0 kérés';
    const from = (this.page() - 1) * this.pageSize + 1;
    const to = Math.min(total, this.page() * this.pageSize);
    return `${from}–${to} / ${total} kérés`;
  });

  start(): void {
    this.started.set(true);
  }

  /** Mezőváltás: vissza az 1. oldalra, és (mindig új szűrő-objektummal) újratölt. */
  setFilter(patch: AiRequestLogFilter): void {
    this.filter.update((f) => ({ ...f, ...patch }));
    this.page.set(1);
  }

  clearFilter(): void {
    this.filter.set({});
    this.page.set(1);
  }

  changePage(delta: number): void {
    this.page.update((p) => Math.max(1, p + delta));
  }
}

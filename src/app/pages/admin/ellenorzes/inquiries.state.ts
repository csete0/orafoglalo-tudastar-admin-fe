import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminInstitutionalInquiryService } from '../../../services/admin/admin-institutional-inquiry.service';
import { InstitutionalInquiryDto } from '../../../models/institutional-inquiry.model';
import { ToastService } from '../../../shared/toast/toast.service';
import { latestValue } from '../../../shared/resource/latest-value';
import { OpenListQuery } from './question-reports.state';

/**
 * Az Érdeklődések fül állapota. Az oldal `providers`-ében él, így fülváltáskor a szűrő, az oldal, a lista és a begépelt
 * megjegyzések megmaradnak. Lusta: az oldal a fülre lépéskor hívja az `enter()`-t; ez az első alkalommal, utána pedig csak
 * üres lista esetén tölt (újra).
 */
@Injectable()
export class InquiriesState {
  private readonly svc = inject(AdminInstitutionalInquiryService);
  private readonly toast = inject(ToastService);

  readonly pageSize = 20;
  readonly query = signal<OpenListQuery>({ onlyOpen: true, page: 1 });
  /** Érdeklődésenként a „Kezelve” megjegyzés (a sablon `ngModel`-je írja). */
  readonly handledNotes: Record<number, string> = {};

  private readonly started = signal(false);
  private readonly resource = rxResource({
    params: () => (this.started() ? this.query() : undefined),
    stream: ({ params }) => this.svc.getInquiries(params.onlyOpen, params.page, this.pageSize),
  });
  /** Betöltés közben és hiba után a korábbi lista marad; a műveletek helyben frissítik. */
  private readonly list = latestValue(this.resource);

  readonly inquiries = computed(() => this.list()?.items ?? []);
  readonly totalCount = computed(() => this.list()?.totalCount ?? 0);
  readonly loading = this.resource.isLoading;
  readonly error = computed(() => (this.resource.error() ? 'Az érdeklődések betöltése sikertelen.' : null));
  readonly pending = signal(false);

  /** A fülre lépéskor: üres listánál (első alkalom, hiba vagy minden kezelve után) a mostani szűrővel (újra)tölt. */
  enter(): void {
    if (this.inquiries().length > 0 || this.loading()) return;
    this.started.set(true);
    this.query.update((q) => ({ ...q }));
  }

  setOnlyOpen(onlyOpen: boolean): void {
    this.query.set({ onlyOpen, page: 1 });
  }

  setPage(page: number): void {
    this.query.update((q) => ({ ...q, page }));
  }

  markHandled(inq: InstitutionalInquiryDto): void {
    this.pending.set(true);
    const note = this.handledNotes[inq.id] || null;
    this.svc.markHandled(inq.id, note).subscribe({
      next: () => {
        this.pending.set(false);
        this.list.update((list) => list && (this.query().onlyOpen
          ? { items: list.items.filter((i) => i.id !== inq.id), totalCount: list.totalCount - 1 }
          : {
            ...list,
            items: list.items.map((i) => (i.id === inq.id
              ? { ...i, isHandled: true, handledAt: new Date().toISOString(), note: note ?? undefined }
              : i)),
          }));
        this.toast.success('Érdeklődés kezelve jelölve.');
      },
      error: () => { this.pending.set(false); this.toast.danger('Hiba történt.'); },
    });
  }
}

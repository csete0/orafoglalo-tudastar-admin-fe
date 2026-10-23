import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { LocalSpinnerComponent } from '../../../shared/local-spinner/local-spinner.component';
import { PaymentReviewState } from './payment-review.state';

/**
 * Ellenőrzés oldal, Fizetések fül: a manuális felülvizsgálatot igénylő fizetések a „Felülvizsgálva” művelettel. Az állapot
 * a `PaymentReviewState`-ben (oldal-szintű). A gazda-elem `display: contents`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-payment-review-tab',
  imports: [CurrencyPipe, DatePipe, LocalSpinnerComponent],
  styles: ':host { display: contents; }',
  template: `
    @if (state.error()) {
      <p class="text-danger text-sm mb-4">{{ state.error() }}</p>
    }
    @if (state.loading()) {
      <app-local-spinner />
    } @else {
      <ul class="space-y-3">
        @for (p of state.payments(); track p.id) {
          <li class="card p-4">
            <div class="flex justify-between items-start gap-3 mb-1">
              <div class="min-w-0">
                <p class="font-semibold text-sm">{{ p.userEmail }}</p>
                <p class="text-xs text-text-muted mt-0.5">
                  {{ p.amount | currency: 'HUF' : 'symbol' : '1.0-0' : 'hu' }}
                  · <span class="font-mono">{{ p.stripePaymentIntentId }}</span>
                </p>
              </div>
              <span class="text-xs text-text-muted shrink-0">{{ p.createdAt | date: 'yyyy.MM.dd HH:mm' }}</span>
            </div>
            @if (p.reviewNote) {
              <p class="text-sm mb-2 break-words border-l-2 border-border-default pl-2 text-text-muted italic">„{{ p.reviewNote }}"</p>
            }
            <button (click)="state.markReviewDone(p)" [disabled]="state.pending()"
              class="btn btn-primary !px-3 !py-1.5 !text-xs mt-2">
              Felülvizsgálva
            </button>
          </li>
        } @empty {
          <li class="text-text-muted text-sm py-6 text-center">Nincs manuális felülvizsgálatot igénylő fizetés.</li>
        }
      </ul>
    }
  `,
})
export class PaymentReviewTabComponent {
  protected readonly state = inject(PaymentReviewState);
}

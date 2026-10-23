import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UserDetailPayment } from '../../services/users/user.service';

/** „Fizetések” szakasz: `<section app-user-payments [payments]="…">`; a kézi ellenőrzést igénylő sor kiemelve. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'section[app-user-payments]',
  template: `
    <h2>Fizetések</h2>
    @if (payments().length) {
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Dátum</th><th>Összeg</th><th>Állapot</th><th>Mód</th><th>Stripe</th></tr>
          </thead>
          <tbody>
            @for (p of payments(); track p.id) {
              <tr [class.flagged]="p.needsManualReview">
                <td>{{ p.paymentDate }}</td>
                <td>{{ p.amount }} Ft</td>
                <td>{{ p.status }}{{ p.refunded ? ' (visszatérítve)' : '' }}</td>
                <td>{{ p.paymentMethod ?? '-' }}</td>
                <td>
                  @if (p.stripePaymentIntentUrl) {
                    <a [href]="p.stripePaymentIntentUrl" target="_blank" rel="noopener">Megnyitás</a>
                  } @else { - }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="empty">Nincs fizetése.</p>
    }
  `,
  styleUrl: './user-detail-section.css',
})
export class UserPaymentsComponent {
  readonly payments = input.required<readonly UserDetailPayment[]>();
}

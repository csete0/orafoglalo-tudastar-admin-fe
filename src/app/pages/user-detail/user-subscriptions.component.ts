import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UserDetailSubscription } from '../../services/users/user.service';

/** „Előfizetések” szakasz: `<section app-user-subscriptions [subscriptions]="…">`. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'section[app-user-subscriptions]',
  template: `
    <h2>Előfizetések</h2>
    @if (subscriptions().length) {
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Csomag</th><th>Állapot</th><th>Kezdet</th><th>Vég</th><th>AutoRenew</th><th>Ajándék</th></tr>
          </thead>
          <tbody>
            @for (s of subscriptions(); track s.id) {
              <tr>
                <td>{{ s.subscriptionTypeName }}</td>
                <td>{{ s.status }}</td>
                <td>{{ s.startDate }}</td>
                <td>{{ s.endDate }}</td>
                <td>{{ s.autoRenew ? 'Igen' : 'Nem' }}</td>
                <td>{{ s.activatedViaGift ? 'Igen' : '-' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="empty">Nincs előfizetése.</p>
    }
  `,
  styleUrl: './user-detail-section.css',
})
export class UserSubscriptionsComponent {
  readonly subscriptions = input.required<readonly UserDetailSubscription[]>();
}

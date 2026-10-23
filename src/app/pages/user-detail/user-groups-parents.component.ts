import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UserDetailGroupMembership, UserDetailParentEmail } from '../../services/users/user.service';

/**
 * „Csoporttagságok” és „Szülői e-mailek” – két egymás utáni szakasz. A gazda-elem `display: contents`,
 * így a két `<section>` elrendezése ugyanaz, mintha közvetlenül az oldalon lennének.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-user-groups-parents',
  template: `
    <section>
      <h2>Csoporttagságok</h2>
      @if (memberships().length) {
        <ul class="plain-list">
          @for (g of memberships(); track g.groupId) {
            <li>{{ g.groupName }} - csatlakozott: {{ g.joinedAt }}{{ g.removedAt ? (', kilépett: ' + g.removedAt) : '' }}</li>
          }
        </ul>
      } @else {
        <p class="empty">Nincs csoporttagsága.</p>
      }
    </section>

    <section>
      <h2>Szülői e-mailek</h2>
      @if (parentEmails().length) {
        <ul class="plain-list">
          @for (p of parentEmails(); track p.email) {
            <li>{{ p.email }} {{ p.isVerified ? '(megerősítve)' : '(nincs megerősítve)' }}</li>
          }
        </ul>
      } @else {
        <p class="empty">Nincs regisztrált szülői e-mail.</p>
      }
    </section>
  `,
  styleUrl: './user-detail-section.css',
  styles: ':host { display: contents; }',
})
export class UserGroupsParentsComponent {
  readonly memberships = input.required<readonly UserDetailGroupMembership[]>();
  readonly parentEmails = input.required<readonly UserDetailParentEmail[]>();
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UserDetailTeacherProfile } from '../../services/users/user.service';
import { BytesPipe } from '../../shared/format/bytes.pipe';

/** „Tanári profil” szakasz: `<section app-user-teacher-profile [profile]="…">`. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'section[app-user-teacher-profile]',
  imports: [BytesPipe],
  template: `
    @let tp = profile();
    <h2>Tanári profil</h2>
    <dl>
      <dt>Megjelenített név</dt><dd>{{ tp.displayName }}</dd>
      <dt>Intézmény</dt><dd>{{ tp.institutionName ?? '-' }}</dd>
      <dt>Állapot</dt><dd>{{ tp.isActive ? 'Aktív' : 'Letiltva' }}</dd>
      <dt>Feladatsor-kvóta</dt>
      <dd>{{ tp.actualTaskSetCount }} / {{ tp.maxTaskSets ?? 'korlátlan' }}</dd>
      <dt>Tárhely-kvóta</dt>
      <dd>{{ tp.actualStorageBytes | bytes }} / {{ tp.maxStorageBytes ? (tp.maxStorageBytes | bytes) : 'korlátlan' }}</dd>
      <dt>Iskolái</dt><dd>{{ tp.schoolNames.join(', ') || '-' }}</dd>
      <dt>Csoportjai</dt><dd>{{ tp.groupNames.join(', ') || '-' }}</dd>
    </dl>
  `,
  styleUrl: './user-detail-section.css',
})
export class UserTeacherProfileComponent {
  readonly profile = input.required<UserDetailTeacherProfile>();
}

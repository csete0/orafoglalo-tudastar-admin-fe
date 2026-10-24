import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProjectAdminUserProject, RUNTIME_LABELS } from '../../models/projektmuhely.model';

/** „Projektműhely” szakasz: `<section app-user-projects [projects]="…">`; `null` = a betöltés nem sikerült. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'section[app-user-projects]',
  template: `
    <h2>Projektműhely</h2>
    @if (projects(); as list) {
      @if (list.length) {
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>Projekt</th><th>Nyelv</th><th>Lépés</th><th>Teljesítve</th><th>Ellenőrzés</th><th>Tipp · hely · kód</th><th>AI (30 nap)</th><th>Utoljára</th></tr>
            </thead>
            <tbody>
              @for (p of list; track p.slug + p.runtime) {
                <tr>
                  <td>{{ p.title }}{{ p.completedAt ? ' ✓ kész' : '' }}</td>
                  <td>{{ runtimeLabels[p.runtime] ?? p.runtime }}</td>
                  <td>{{ p.currentMilestoneOrder }}.</td>
                  <td>{{ p.passedCount }} / {{ p.milestoneCount }}</td>
                  <td>{{ p.checks }}</td>
                  <td>{{ p.hint1 }} · {{ p.hint2 }} · {{ p.hint3 }}</td>
                  <td>{{ '$' + p.aiCostUsd30.toFixed(p.aiCostUsd30 < 0.01 ? 4 : 3) }}</td>
                  <td>{{ p.lastActivityAt ? p.lastActivityAt.slice(0, 16).replace('T', ' ') : '-' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="empty">Még nem kezdett projektet.</p>
      }
    } @else {
      <p class="error">A Projektműhely-adatokat nem sikerült betölteni.</p>
    }
  `,
  styleUrl: './user-detail-section.css',
})
export class UserProjectsComponent {
  readonly projects = input.required<readonly ProjectAdminUserProject[] | null>();
  readonly runtimeLabels = RUNTIME_LABELS;
}

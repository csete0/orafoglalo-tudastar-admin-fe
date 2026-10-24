import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { AdminMockExamLeaderboardEntry } from '../../../models/mock-exam.model';

export interface LeaderboardHideRequest { entry: AdminMockExamLeaderboardEntry; hidden: boolean }

/**
 * Toplista-moderálás (a becenévvel jelentkezők, a rejtettek is): levétel megerősítéssel, visszahelyezés közvetlenül.
 * `<div app-mock-exam-leaderboard class="card p-5 mt-4" data-testid="mock-leaderboard" [entries]="…" [busy]="…" (hiddenChange)="…">`
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'div[app-mock-exam-leaderboard]',
  imports: [DecimalPipe],
  template: `
    <h3 class="font-bold">Toplista (becenévvel jelentkezők)</h3>
    <p class="text-xs text-text-muted mt-0.5">A nem odaillő becenevet leveheted - a nyilvános toplistáról és a megosztott kártyáról azonnal eltűnik.</p>
    <div class="overflow-x-auto mt-3">
      <table class="w-full text-sm">
        <thead><tr class="text-left text-xs text-text-muted">
          <th class="py-2 pr-3">Szint</th><th class="pr-3 text-right">Helyezés</th><th class="pr-3">Becenév</th><th class="pr-3 text-right">Eredmény</th><th></th>
        </tr></thead>
        <tbody>
          @for (e of entries(); track e.registrationId) {
            <tr class="border-t border-border-default" [class.opacity-60]="e.hiddenByAdminAt">
              <td class="py-1.5 pr-3">{{ e.level === 'emelt' ? 'emelt' : 'közép' }}</td>
              <td class="pr-3 text-right tabular-nums">{{ e.rank === null ? '–' : e.rank + '.' }}</td>
              <td class="pr-3">{{ e.publicName }} @if (e.hiddenByAdminAt) { <span class="text-xs text-warning">(levéve)</span> }</td>
              <td class="pr-3 text-right tabular-nums">{{ e.percent === null ? '–' : (e.percent | number: '1.0-1') + '%' }}</td>
              <td class="text-right">
                <button type="button" class="btn btn-ghost text-xs" [disabled]="busy()" [attr.data-testid]="'mock-hide-' + e.registrationId"
                  (click)="toggle(e)">{{ e.hiddenByAdminAt ? 'Visszahelyezés' : 'Levétel' }}</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="py-3 text-text-muted">Senki nem kérte a toplistás megjelenést.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class MockExamLeaderboardComponent {
  private readonly confirm = inject(ConfirmService);

  readonly entries = input.required<AdminMockExamLeaderboardEntry[]>();
  readonly busy = input(false);
  /** Levétel (a megerősítés után) vagy visszahelyezés kérése - a hívás és az újratöltés a szülőé. */
  readonly hiddenChange = output<LeaderboardHideRequest>();

  async toggle(entry: AdminMockExamLeaderboardEntry): Promise<void> {
    const hidden = !entry.hiddenByAdminAt;
    if (hidden && !(await this.confirm.ask({
      title: 'Levétel a toplistáról',
      message: `„${entry.publicName}” becenév nem jelenik meg a nyilvános toplistán és a megosztott kártyán. Később visszahelyezhető.`,
      confirmLabel: 'Levétel',
    }))) return;
    this.hiddenChange.emit({ entry, hidden });
  }
}

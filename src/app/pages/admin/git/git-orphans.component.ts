import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminGitService } from '../../../services/admin/admin-git.service';

/**
 * Árva Forgejo-tárolók (PATRICKS-DEMO-KORNYEZET-TERV.md K6): a napi job első észleléskor csak megjelöli az alkalmazás névmintájú, gazda
 * nélküli tárolókat, és a türelmi idő után törli őket (auditnaplóval). Csak megjelenítés - a takarítás automatikus.
 */
@Component({
  selector: 'app-git-orphans',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card p-5 space-y-3" data-testid="git-orphans" aria-labelledby="git-orphans-title">
      <h2 id="git-orphans-title" class="font-bold">Árva tárolók</h2>
      <p class="text-sm text-text-muted">
        Gazda nélküli tárolók a Git-szerveren. A napi takarítás első észleléskor csak megjelöli őket, és a türelmi idő után törli
        (egy futásban legfeljebb 20-at); minden törlés az audit-naplóba kerül.
      </p>
      @if (orphans.error()) {
        <p class="text-danger text-sm" role="alert">Az árva tárolók listája nem tölthető be.</p>
      } @else if (orphans.isLoading() && !orphans.hasValue()) {
        <p class="text-sm text-text-muted">Betöltés…</p>
      } @else {
        <p class="text-sm" data-testid="git-orphans-summary">{{ marked().length }} megjelölt · {{ deleted().length }} törölve az utolsó 90 napban</p>
        <ul class="divide-y divide-border-default">
          @for (o of rows(); track o.id) {
            <li class="py-2 flex flex-wrap items-center gap-2 text-sm" [attr.data-testid]="'git-orphan-' + o.id">
              <span class="font-mono break-all">{{ o.name }}</span>
              @if (o.status === 'marked') {
                <span class="badge badge-warning">jelölve</span>
                <span class="text-text-muted">észlelve {{ o.firstSeenAt | date: 'yyyy.MM.dd.' }} · törlés legkorábban {{ o.deletesAfter | date: 'yyyy.MM.dd.' }}</span>
              } @else {
                <span class="badge badge-neutral">törölve</span>
                <span class="text-text-muted">{{ o.deletedAt | date: 'yyyy.MM.dd. HH:mm' }}</span>
              }
            </li>
          } @empty {
            <li class="py-2 text-sm text-text-muted">Nincs árva tároló.</li>
          }
        </ul>
      }
    </section>
  `,
})
export class GitOrphansComponent {
  private readonly api = inject(AdminGitService);

  readonly orphans = rxResource({ stream: () => this.api.orphans() });
  readonly rows = computed(() => (this.orphans.hasValue() ? this.orphans.value() : []));
  readonly marked = computed(() => this.rows().filter((o) => o.status === 'marked'));
  readonly deleted = computed(() => this.rows().filter((o) => o.status === 'deleted'));
}

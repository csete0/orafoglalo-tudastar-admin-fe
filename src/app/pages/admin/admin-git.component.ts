import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';
import { AdminGitService } from '../../services/admin/admin-git.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { extractErrorMessage } from '../../shared/http-error/extract-error-message.util';
import { latestValue } from '../../shared/resource/latest-value';
import { reportErrors } from '../../shared/resource/report-errors';
import { GIT_PURPOSE_LABELS, GitAdminRepo, GitQuota } from '../../models/git.model';

const ACTION_ERROR = 'A művelet nem sikerült.';

/** Git-adminisztráció (PATRICKS-FEJLESZTOMUHELY-BC-TERV.md 2.2, 4.): kvóták és tárolók (zár visszaélésnél, törlés). */
@Component({
  selector: 'app-admin-git',
  imports: [FormsModule, ReactiveFormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-5xl">
      <p class="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Platform-admin</p>
      <h1 class="page-title">Git</h1>
      <p class="text-sm text-text-muted mt-1 max-w-xl">
        A diákok Git-tárolóinak kvótái, keresés e-mail címre vagy tárolónévre, zárolás visszaélésnél és törlés. Minden módosítás az audit-naplóba kerül.
      </p>
      <div class="hairline"></div>

      @if (error()) { <p class="text-danger text-sm mb-4" role="alert">{{ error() }}</p> }

      <form class="card p-5 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-4" [formGroup]="form" (ngSubmit)="form.valid && saveQuota()" data-testid="git-quota">
        <h2 class="col-span-full font-bold">Kvóták</h2>
        <label class="text-sm min-w-0">Tároló mérete (MB)
          <input class="input w-full" type="number" min="1" max="500" name="repoMaxMb" formControlName="repoMaxMb" /></label>
        <label class="text-sm min-w-0">Saját tároló / diák
          <input class="input w-full" type="number" min="1" max="200" name="reposPerUser" formControlName="reposPerUser" /></label>
        <label class="text-sm min-w-0">Fájlméret (MB)
          <input class="input w-full" type="number" min="1" max="100" name="fileMaxMb" formControlName="fileMaxMb" /></label>
        <label class="text-sm min-w-0">Push / perc
          <input class="input w-full" type="number" min="1" max="120" name="pushesPerMinute" formControlName="pushesPerMinute" /></label>
        <label class="text-sm min-w-0">Klón / perc
          <input class="input w-full" type="number" min="1" max="600" name="clonesPerMinute" formControlName="clonesPerMinute" /></label>
        <label class="text-sm min-w-0">.git-mentés (MB)
          <input class="input w-full" type="number" min="1" max="50" name="snapshotMaxMb" formControlName="snapshotMaxMb" /></label>
        <label class="text-sm min-w-0">Csapattároló mérete (MB)
          <input class="input w-full" type="number" min="1" max="500" name="teamRepoMaxMb" formControlName="teamRepoMaxMb" /></label>
        <p class="col-span-full text-xs text-text-muted">A saját tárolók számába csak a projekt-tárolók számítanak, a gyakorlók nem.</p>
        <div class="col-span-full flex flex-wrap items-center gap-3">
          <button class="btn btn-primary" type="submit" data-testid="git-quota-save" [disabled]="busy() || form.invalid">Mentés</button>
          @if (form.invalid) { <span class="text-xs text-danger">Minden mező kitöltendő, a megadott határokon belül.</span> }
          @if (quota(); as q) { <span class="text-xs text-text-muted">Utoljára módosítva: {{ q.updatedAt | date: 'yyyy.MM.dd. HH:mm' }}</span> }
        </div>
      </form>

      <div class="card p-5 space-y-3">
        <h2 class="font-bold">Tárolók</h2>
        <div class="flex gap-2 flex-wrap">
          <input class="input flex-1 min-w-0 basis-48" type="search" placeholder="E-mail vagy tárolónév" [ngModel]="query()" (ngModelChange)="query.set($event)"
                 (keyup.enter)="search()" aria-label="Keresés e-mail címre vagy tárolónévre" />
          <button class="btn btn-ghost" type="button" (click)="search()" [disabled]="busy()">Keresés</button>
        </div>
        <label class="text-sm block">Zárolás oka (kötelező; a tárolóhoz mentődik, a diák is látja)
          <input class="input w-full" type="text" maxlength="200" placeholder="pl. nem odaillő tartalom" [ngModel]="lockReason()"
                 (ngModelChange)="lockReason.set($event)" /></label>
        <ul class="divide-y divide-border-default">
          @for (r of repos(); track r.id) {
            <li class="py-2 flex flex-wrap items-center gap-2 text-sm" [attr.data-testid]="'git-repo-' + r.id">
              <span class="font-mono break-all">{{ r.name }}</span>
              <span class="text-text-muted break-all">{{ owner(r) }} · {{ (r.sizeKb / 1024).toFixed(1) }} MB · {{ purposeLabel(r) }}
                · {{ r.lastPushAt ? 'utolsó push: ' + (r.lastPushAt | date: 'yyyy.MM.dd. HH:mm') : 'még nem pusholtak' }}</span>
              @if (r.locked) { <span class="badge badge-danger">zárolva{{ r.lockReason ? ': ' + r.lockReason : '' }}</span> }
              @if (r.overQuota) { <span class="badge badge-warning">kvóta felett</span> }
              <span class="ml-auto flex gap-2">
                @if (r.locked) {
                  <button class="btn btn-ghost !py-0.5" type="button" [disabled]="busy()" (click)="unlock(r)" [attr.aria-label]="'Feloldás: ' + r.name">Feloldás</button>
                } @else {
                  <button class="btn btn-ghost !py-0.5" type="button" [disabled]="busy() || !lockReason().trim()" (click)="lock(r)"
                          [attr.aria-label]="'Zárolás: ' + r.name" [title]="lockReason().trim() ? 'Zárolás' : 'Előbb add meg a zárolás okát'">Zárolás</button>
                }
                <button class="btn btn-danger !py-0.5" type="button" [disabled]="busy()" (click)="remove(r)" [attr.aria-label]="'Törlés: ' + r.name">Törlés</button>
              </span>
            </li>
          } @empty {
            <li class="py-2 text-sm text-text-muted">Nincs találat.</li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class AdminGitComponent {
  private readonly api = inject(AdminGitService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly quota = signal<GitQuota | null>(null);
  readonly query = signal('');
  readonly lockReason = signal('');
  /** Egy közös hibasor: minden betöltés és művelet induláskor törli, hibánál a sajátját írja ki. */
  readonly error = signal<string | null>(null);

  /** A határok a BE-validációé; az üres mező érvénytelen, így mentéskor minden érték szám. */
  readonly form = this.fb.group({
    repoMaxMb: [50, bounded(500)],
    reposPerUser: [20, bounded(200)],
    fileMaxMb: [5, bounded(100)],
    pushesPerMinute: [6, bounded(120)],
    clonesPerMinute: [20, bounded(600)],
    snapshotMaxMb: [10, bounded(50)],
    teamRepoMaxMb: [50, bounded(500)],
  });

  /** A keresés kérése: minden keresés új objektum, így ugyanarra a szóra is újratölt. */
  private readonly searchRequest = signal({ q: '' });
  private readonly reposResource = rxResource({
    params: () => this.searchRequest(),
    stream: ({ params }) => reportErrors(this.api.searchRepos(params.q), this.error, (err) => extractErrorMessage(err, ACTION_ERROR)),
  });
  /** Keresés közben és hiba után a korábbi találatok maradnak. */
  private readonly latestRepos = latestValue(this.reposResource);
  readonly repos = computed(() => this.latestRepos() ?? []);

  private readonly actionBusy = signal(false);
  readonly busy = computed(() => this.actionBusy() || this.reposResource.isLoading());

  constructor() {
    this.run(this.api.getQuota(), (q) => {
      this.form.patchValue(q);
      this.quota.set(q);
    });
  }

  /** A tároló gazdája: a diák e-mailje, csapattárolónál a csapat azonosítója. */
  owner(r: GitAdminRepo): string {
    return r.ownerEmail ?? (r.ownerTeamId !== null ? `csapat #${r.ownerTeamId}` : '–');
  }

  purposeLabel(r: GitAdminRepo): string {
    const label = GIT_PURPOSE_LABELS[r.purpose] ?? r.purpose;
    return r.projectSlug ? `${label} (${r.projectSlug})` : label;
  }

  async saveQuota(): Promise<void> {
    if (!(await this.confirm.ask({
      title: 'Kvóták mentése',
      message: 'A kvóták legfeljebb fél percen belül érvényesek; a méret-korlátot a meglévő tárolókra 5 percen belül telepíti a rendszer.',
      confirmLabel: 'Mentés',
    }))) return;
    this.run(this.api.updateQuota(this.form.getRawValue()), (q) => this.quota.set(q));
  }

  search(): void {
    this.searchRequest.set({ q: this.query().trim() });
  }

  async lock(r: GitAdminRepo): Promise<void> {
    const reason = this.lockReason().trim();
    if (!reason) {
      this.error.set('A zároláshoz add meg az okát.');
      return;
    }
    if (!(await this.confirm.ask({
      title: 'Tároló zárolása',
      message: `A(z) „${r.name}” tároló (${this.owner(r)}) zárolódik: a diák nem klónozhatja és nem fetch-elheti, nem pusholhat bele, nem mentheti és nem törölheti. Ok: „${reason}”.`,
      confirmLabel: 'Zárolás',
      danger: true,
    }))) return;
    this.run(this.api.lock(r.id, reason), () => {
      this.lockReason.set('');
      this.search();
    });
  }

  async unlock(r: GitAdminRepo): Promise<void> {
    if (!(await this.confirm.ask({
      title: 'Zárolás feloldása',
      message: `A(z) „${r.name}” tároló (${this.owner(r)}) zárolása feloldódik${r.lockReason ? ` (ok volt: „${r.lockReason}”)` : ''}.`,
      confirmLabel: 'Feloldás',
    }))) return;
    this.run(this.api.unlock(r.id), () => this.search());
  }

  async remove(r: GitAdminRepo): Promise<void> {
    if (!(await this.confirm.ask({
      title: 'Tároló törlése',
      message: `A(z) „${r.name}” tároló (${this.owner(r)}) véglegesen törlődik, a böngészős mentésével együtt. Biztos?`,
      confirmLabel: 'Törlés',
      danger: true,
    }))) return;
    this.run(this.api.remove(r.id), () => this.search());
  }

  /** Sikernél `onSuccess` (hibánál nincs újratöltés, hogy az üzenet látsszon); hibánál a szerver magyar üzenete jelenik meg. */
  private run<T>(action: Observable<T>, onSuccess: (value: T) => void): void {
    this.actionBusy.set(true);
    this.error.set(null);
    action.pipe(finalize(() => this.actionBusy.set(false))).subscribe({
      next: onSuccess,
      error: (err: unknown) => this.error.set(extractErrorMessage(err, ACTION_ERROR)),
    });
  }
}

/** Kötelező egész 1 és `max` között. */
function bounded(max: number) {
  return [Validators.required, Validators.min(1), Validators.max(max)];
}

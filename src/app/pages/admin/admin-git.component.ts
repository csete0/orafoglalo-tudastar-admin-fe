import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminGitService } from '../../services/admin/admin-git.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { GIT_PURPOSE_LABELS, GitAdminRepo, GitQuota } from '../../models/git.model';

/** Git-adminisztráció (PATRICKS-FEJLESZTOMUHELY-BC-TERV.md 2.2, 4.): kvóták és tárolók (zár visszaélésnél, törlés). */
@Component({
  selector: 'app-admin-git',
  standalone: true,
  imports: [FormsModule, DatePipe],
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

      <form class="card p-5 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-4" #quotaForm="ngForm" (ngSubmit)="quotaForm.valid && saveQuota()" data-testid="git-quota">
        <h2 class="col-span-full font-bold">Kvóták</h2>
        <label class="text-sm min-w-0">Tároló mérete (MB)
          <input class="input w-full" type="number" min="1" max="500" required name="repoMaxMb" [(ngModel)]="form.repoMaxMb" /></label>
        <label class="text-sm min-w-0">Saját tároló / diák
          <input class="input w-full" type="number" min="1" max="200" required name="reposPerUser" [(ngModel)]="form.reposPerUser" /></label>
        <label class="text-sm min-w-0">Fájlméret (MB)
          <input class="input w-full" type="number" min="1" max="100" required name="fileMaxMb" [(ngModel)]="form.fileMaxMb" /></label>
        <label class="text-sm min-w-0">Push / perc
          <input class="input w-full" type="number" min="1" max="120" required name="pushesPerMinute" [(ngModel)]="form.pushesPerMinute" /></label>
        <label class="text-sm min-w-0">Klón / perc
          <input class="input w-full" type="number" min="1" max="600" required name="clonesPerMinute" [(ngModel)]="form.clonesPerMinute" /></label>
        <label class="text-sm min-w-0">.git-mentés (MB)
          <input class="input w-full" type="number" min="1" max="50" required name="snapshotMaxMb" [(ngModel)]="form.snapshotMaxMb" /></label>
        <p class="col-span-full text-xs text-text-muted">A saját tárolók számába csak a projekt-tárolók számítanak, a gyakorlók nem.</p>
        <div class="col-span-full flex flex-wrap items-center gap-3">
          <button class="btn btn-primary" type="submit" data-testid="git-quota-save" [disabled]="busy() || quotaForm.invalid">Mentés</button>
          @if (quotaForm.invalid) { <span class="text-xs text-danger">Minden mező kitöltendő, a megadott határokon belül.</span> }
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
              <span class="text-text-muted break-all">{{ r.ownerEmail }} · {{ (r.sizeKb / 1024).toFixed(1) }} MB · {{ purposeLabel(r) }}
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
export class AdminGitComponent implements OnInit {
  private readonly api = inject(AdminGitService);
  private readonly confirm = inject(ConfirmService);

  readonly quota = signal<GitQuota | null>(null);
  readonly repos = signal<GitAdminRepo[]>([]);
  readonly query = signal('');
  readonly lockReason = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  form = { repoMaxMb: 50, reposPerUser: 20, fileMaxMb: 5, pushesPerMinute: 6, clonesPerMinute: 20, snapshotMaxMb: 10 };

  async ngOnInit(): Promise<void> {
    await this.run(async () => {
      const q = await firstValueFrom(this.api.getQuota());
      this.form = { repoMaxMb: q.repoMaxMb, reposPerUser: q.reposPerUser, fileMaxMb: q.fileMaxMb, pushesPerMinute: q.pushesPerMinute,
        clonesPerMinute: q.clonesPerMinute, snapshotMaxMb: q.snapshotMaxMb };
      this.quota.set(q);
    });
    await this.search();
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
    await this.run(async () => this.quota.set(await firstValueFrom(this.api.updateQuota(this.form))));
  }

  async search(): Promise<void> {
    await this.run(async () => this.repos.set(await firstValueFrom(this.api.searchRepos(this.query().trim()))));
  }

  async lock(r: GitAdminRepo): Promise<void> {
    const reason = this.lockReason().trim();
    if (!reason) {
      this.error.set('A zároláshoz add meg az okát.');
      return;
    }
    if (!(await this.confirm.ask({
      title: 'Tároló zárolása',
      message: `A(z) „${r.name}” tároló (${r.ownerEmail}) zárolódik: a diák nem klónozhatja és nem fetch-elheti, nem pusholhat bele, nem mentheti és nem törölheti. Ok: „${reason}”.`,
      confirmLabel: 'Zárolás',
      danger: true,
    }))) return;
    if (!(await this.run(() => firstValueFrom(this.api.lock(r.id, reason))))) return;
    this.lockReason.set('');
    await this.search();
  }

  async unlock(r: GitAdminRepo): Promise<void> {
    if (!(await this.confirm.ask({
      title: 'Zárolás feloldása',
      message: `A(z) „${r.name}” tároló (${r.ownerEmail}) zárolása feloldódik${r.lockReason ? ` (ok volt: „${r.lockReason}”)` : ''}.`,
      confirmLabel: 'Feloldás',
    }))) return;
    if (await this.run(() => firstValueFrom(this.api.unlock(r.id)))) await this.search();
  }

  async remove(r: GitAdminRepo): Promise<void> {
    if (!(await this.confirm.ask({
      title: 'Tároló törlése',
      message: `A(z) „${r.name}” tároló (${r.ownerEmail}) véglegesen törlődik, a böngészős mentésével együtt. Biztos?`,
      confirmLabel: 'Törlés',
      danger: true,
    }))) return;
    if (await this.run(() => firstValueFrom(this.api.remove(r.id)))) await this.search();
  }

  /** true, ha a művelet sikerült (hibánál nincs újratöltés, hogy az üzenet látsszon); hibánál a szerver magyar üzenete (ErrorModel.errorMessage) jelenik meg. */
  private async run(action: () => Promise<unknown>): Promise<boolean> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      return true;
    } catch (e: unknown) {
      this.error.set((e as { error?: { errorMessage?: string } })?.error?.errorMessage ?? 'A művelet nem sikerült.');
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}

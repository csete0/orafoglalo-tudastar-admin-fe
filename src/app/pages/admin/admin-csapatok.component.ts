import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminTeamService } from '../../services/admin/admin-team.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { AdminTeamDetail, AdminTeamRow, SYNC_LABELS } from '../../models/team.model';

/** Vizsgaremek-csapatok (PATRICKS-FEJLESZTOMUHELY-BC-TERV.md 3.): keresés, tükrözési hibák, újrapróbálás, leválasztás. */
@Component({
  selector: 'app-admin-csapatok',
  standalone: true,
  imports: [FormsModule, DatePipe, KeyValuePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-5xl">
      <p class="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Platform-admin</p>
      <h1 class="page-title">Csapatok</h1>
      <p class="text-sm text-text-muted mt-1 max-w-xl">Vizsgaremek-csapatok, GitHub-tükrözés állapota, MI-átnézések a hónapban. A módosítások az audit-naplóba kerülnek.</p>
      <div class="hairline"></div>
      @if (error()) { <p class="text-danger text-sm mb-4" role="alert">{{ error() }}</p> }
      <div class="card p-5 space-y-3">
        <div class="flex gap-2 flex-wrap items-center">
          <input class="input flex-1 min-w-0 basis-48" type="search" placeholder="Csapatnév, tag e-mail címe vagy GitHub-repó" [ngModel]="query()"
                 (ngModelChange)="query.set($event)" (keyup.enter)="load()" aria-label="Keresés" />
          <label class="text-sm flex items-center gap-1"><input type="checkbox" [ngModel]="problems()" (ngModelChange)="problems.set($event); load()" /> csak tükrözési hibák</label>
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="busy()">Keresés</button>
        </div>
        <ul class="divide-y divide-border-default">
          @for (t of rows(); track t.id) {
            <li class="py-2 text-sm flex flex-wrap items-center gap-2" [attr.data-testid]="'team-' + t.id">
              <button class="font-bold underline" type="button" (click)="open(t)">{{ t.name }}</button>
              <span class="text-text-muted">{{ t.kind === 'school' ? 'iskolai' + (t.groupName ? ' · ' + t.groupName : '') : 'egyéni' }} · {{ t.members }} tag ·
                {{ t.repoName ?? 'nincs tároló' }}{{ t.repoSizeKb !== null ? ' (' + (t.repoSizeKb / 1024).toFixed(1) + ' MB)' : '' }} ·
                MI-átnézés: {{ t.reviewsThisMonth }} ({{ t.reviewCostUsd.toFixed(3) }} $)</span>
              @if (t.githubRepo) {
                <span class="badge" [class.badge-danger]="t.githubStatus === 'broken' || t.lastSyncStatus === 'error'"
                      [class.badge-warning]="t.lastSyncStatus === 'diverged' || t.lastSyncStatus === 'workflow_blocked'">
                  {{ t.githubRepo }}: {{ t.githubStatus === 'broken' ? 'megszakadt' : t.githubStatus === 'unlinked' ? 'leválasztva' : syncLabel(t.lastSyncStatus) }}</span>
                <span class="ml-auto flex gap-2">
                  <button class="btn btn-ghost !py-0.5" type="button" [disabled]="busy() || t.githubStatus !== 'active'" (click)="retry(t)">Újrapróbálás</button>
                  <button class="btn btn-danger !py-0.5" type="button" [disabled]="busy() || t.githubStatus === 'unlinked'" (click)="unlink(t)">Leválasztás</button>
                </span>
              }
              @if (t.lastError) { <span class="basis-full text-xs text-danger break-words">{{ t.lastError }}</span> }
            </li>
          } @empty { <li class="py-2 text-sm text-text-muted">Nincs találat.</li> }
        </ul>
      </div>
      @if (detail(); as d) {
        <div class="card p-5 mt-6 space-y-2" data-testid="team-detail">
          <h2 class="font-bold">{{ d.team.name }}</h2>
          <ul class="text-sm">
            @for (m of d.members; track m.userId) {
              <li>{{ m.name }} · {{ m.email }}{{ m.role ? ' · ' + m.role : '' }} · {{ m.leftAt ? 'kilépett: ' + (m.leftAt | date: 'yyyy.MM.dd.') : 'tag' }}</li>
            }
          </ul>
          <h3 class="font-bold text-sm">Ágak (utolsó tükrözés)</h3>
          <ul class="text-sm font-mono">
            @for (b of d.branches | keyvalue; track b.key) { <li>{{ b.key.replace('refs/heads/', '') }}: {{ b.value.action }}{{ b.value.detail ? ' – ' + b.value.detail : '' }}</li> }
            @empty { <li class="font-sans text-text-muted">Még nem volt tükrözés.</li> }
          </ul>
        </div>
      }
    </div>
  `,
})
export class AdminCsapatokComponent implements OnInit {
  private readonly api = inject(AdminTeamService);
  private readonly confirm = inject(ConfirmService);
  readonly rows = signal<AdminTeamRow[]>([]);
  readonly detail = signal<AdminTeamDetail | null>(null);
  readonly query = signal('');
  readonly problems = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void { void this.load(); }

  syncLabel(status: string | null): string { return status ? (SYNC_LABELS[status] ?? status) : 'még nem futott'; }

  async load(): Promise<void> {
    await this.run(async () => this.rows.set(await firstValueFrom(this.api.search(this.query().trim(), this.problems()))));
  }

  async open(t: AdminTeamRow): Promise<void> {
    await this.run(async () => this.detail.set(await firstValueFrom(this.api.get(t.id))));
  }

  async retry(t: AdminTeamRow): Promise<void> {
    if (await this.run(() => firstValueFrom(this.api.retryMirror(t.id)))) await this.load();
  }

  async unlink(t: AdminTeamRow): Promise<void> {
    const ok = await this.confirm.ask({ title: 'GitHub-kapcsolat leválasztása', message: `A(z) „${t.name}” csapat tükrözése leáll (${t.githubRepo}). A csapat újra összekapcsolhatja.`, danger: true });
    if (ok && (await this.run(() => firstValueFrom(this.api.unlink(t.id))))) await this.load();
  }

  /** Hibánál nem tölt újra (a szerver üzenete látsszon). */
  private async run(action: () => Promise<unknown>): Promise<boolean> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      return true;
    } catch (e) {
      this.error.set((e as { error?: { errorMessage?: string } })?.error?.errorMessage ?? 'A művelet nem sikerült.');
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}

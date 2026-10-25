import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminDemoStore } from '../../../services/admin/admin-demo.store';
import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { UtcPipe } from '../../../shared/utc/utc.pipe';
import { DemoEnvironment, DemoStatus } from '../../../models/demo.model';
import { asUtc } from '../../../models/mock-exam.model';

const STATUS_LABEL: Record<DemoStatus, string> = {
  active: 'Aktív',
  resetting: 'Betöltés…',
  deleting: 'Törlés…',
  deleted: 'Törölve',
  failed: 'Hiba',
};

const STATUS_BADGE: Record<DemoStatus, string> = {
  active: 'badge-success',
  resetting: 'badge-primary',
  deleting: 'badge-warning',
  deleted: 'badge-neutral',
  failed: 'badge-danger',
};

/** 48 órán belüli lejárat pirossal jelölve. */
const SOON_MS = 48 * 3600 * 1000;

/**
 * Egy demó kártyája (PATRICKS-DEMO-KORNYEZET-TERV.md F5): típus, állapot, lejárat, MI-költés a kerethez mérve, fiókok; műveletek:
 * hosszabbítás (+7 / +14 / dátum), visszaállítás, új jelszavak, törlés. A saját demónál az utolsó éjszakai visszaállítás ideje és hibája.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-demo-card',
  imports: [DatePipe, DecimalPipe, FormsModule, UtcPipe],
  template: `
    @let d = demo();
    <article class="card p-4" [attr.data-testid]="'demo-' + d.id">
      <header class="flex items-start justify-between gap-3 flex-wrap">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="badge" [class.badge-primary]="d.kind === 'owner'" [class.badge-neutral]="d.kind === 'school'">
              {{ d.kind === 'owner' ? 'Saját' : 'Iskolai' }}
            </span>
            <span class="badge {{ statusBadge() }}" data-testid="demo-status">{{ statusLabel() }}</span>
            @if (d.loginBlocked && d.status === 'active') {
              <span class="badge badge-danger">Belépés lezárva</span>
            }
          </div>
          <h3 class="font-semibold mt-1 break-words">{{ d.title }}@if (d.city) {<span class="text-text-muted font-normal"> · {{ d.city }}</span>}</h3>
        </div>
        <div class="text-right text-xs text-text-muted">
          <p>létrehozva {{ d.createdAt | utc | date: 'yyyy.MM.dd. HH:mm' }}</p>
          @if (d.lastResetAt) {
            <p data-testid="demo-last-reset">{{ d.nightlyReset ? 'utolsó visszaállítás' : 'betöltve' }} {{ d.lastResetAt | utc | date: 'yyyy.MM.dd. HH:mm' }}
              @if (d.resetCount > 0) { ({{ d.resetCount }}×) }</p>
          }
        </div>
      </header>

      <dl class="grid sm:grid-cols-3 gap-3 text-sm mt-3">
        <div>
          <dt class="text-text-muted text-xs">Lejárat</dt>
          @if (d.expiresAt) {
            <dd [class.text-danger]="expiresSoon()" data-testid="demo-expires">{{ d.expiresAt | utc | date: 'yyyy.MM.dd. HH:mm' }}</dd>
            <dd class="text-xs text-text-muted">törlés: {{ d.deletesAt | utc | date: 'yyyy.MM.dd.' }}</dd>
          } @else {
            <dd>minden éjjel alaphelyzetbe áll</dd>
          }
        </div>
        <div>
          <dt class="text-text-muted text-xs">MI ma / keret</dt>
          <dd>{{ d.aiSpentTodayUsd | number: '1.2-2' }} / {{ d.aiBudgetDailyUsd | number: '1.2-2' }} $
            <span class="text-xs text-text-muted">(fiókonként {{ d.aiPerUserDailyUsd | number: '1.2-2' }} $)</span></dd>
        </div>
        <div>
          <dt class="text-text-muted text-xs">MI összesen</dt>
          <dd>{{ d.aiSpentTotalUsd | number: '1.2-2' }} $@if (d.aiBudgetTotalUsd !== null) { / {{ d.aiBudgetTotalUsd | number: '1.2-2' }} $}</dd>
          <dd class="text-xs text-text-muted">szóbeli: {{ voiceLimit() }}</dd>
        </div>
      </dl>

      @if (d.lastError) {
        <p class="text-danger text-sm mt-2 break-words" data-testid="demo-error">{{ d.lastError }}</p>
      }

      <details class="mt-3 text-sm">
        <summary class="cursor-pointer text-text-muted">Fiókok ({{ d.accounts.length }})</summary>
        <ul class="mt-2 space-y-1">
          @for (a of d.accounts; track a.key) {
            <li class="font-mono text-xs break-all">{{ a.role === 'teacher' ? 'Tanár' : 'Diák' }} · {{ a.name }} · {{ a.email }}</li>
          }
        </ul>
      </details>

      <div class="flex flex-wrap gap-2 mt-4 print:hidden">
        @if (d.kind === 'school') {
          <button type="button" class="btn btn-ghost !text-xs" [disabled]="busy() || inProgress()" (click)="extendDays(7)">+7 nap</button>
          <button type="button" class="btn btn-ghost !text-xs" [disabled]="busy() || inProgress()" (click)="extendDays(14)">+14 nap</button>
          <span class="inline-flex gap-1 items-center">
            <input type="date" class="input !w-auto !text-xs" [(ngModel)]="extendUntil" [attr.aria-label]="'Új lejárat: ' + d.title" />
            <button type="button" class="btn btn-ghost !text-xs" [disabled]="busy() || inProgress() || !extendUntil()" (click)="extendToDate()">Lejárat</button>
          </span>
        }
        <button type="button" class="btn btn-ghost !text-xs" [disabled]="busy() || inProgress()" (click)="reset()" data-testid="demo-reset">
          {{ d.kind === 'owner' ? 'Visszaállítás most' : 'Visszaállítás' }}
        </button>
        <button type="button" class="btn btn-ghost !text-xs" [disabled]="busy() || inProgress()" (click)="passwords()" data-testid="demo-passwords">
          Új jelszavak
        </button>
        <button type="button" class="btn btn-danger !text-xs" [disabled]="busy() || inProgress()" (click)="remove()" data-testid="demo-delete">
          Törlés most
        </button>
      </div>
    </article>
  `,
})
export class DemoCardComponent {
  private readonly store = inject(AdminDemoStore);
  private readonly confirm = inject(ConfirmService);

  readonly demo = input.required<DemoEnvironment>();
  readonly extendUntil = signal('');

  readonly statusLabel = computed(() => STATUS_LABEL[this.demo().status]);
  readonly statusBadge = computed(() => STATUS_BADGE[this.demo().status]);
  readonly inProgress = computed(() => this.demo().status === 'resetting' || this.demo().status === 'deleting');
  readonly busy = computed(() => this.store.mutating());
  readonly voiceLimit = computed(() => {
    const { voiceSessionsDaily: daily, voiceSessionsTotal: total } = this.demo();
    if (daily !== null) return `napi ${daily}`;
    return total !== null ? `összesen ${total}` : 'nincs korlát';
  });
  readonly expiresSoon = computed(() => {
    const expires = this.demo().expiresAt;
    return expires !== null && asUtc(expires).getTime() - Date.now() < SOON_MS;
  });

  extendDays(days: number): void {
    this.store.extend(this.demo().id, { days, expiresAt: null, aiBudgetTotalUsd: null });
  }

  extendToDate(): void {
    const until = this.extendUntil();
    this.store.extend(this.demo().id, { days: null, expiresAt: new Date(`${until}T23:59:00`).toISOString(), aiBudgetTotalUsd: null },
      () => this.extendUntil.set(''));
  }

  async reset(): Promise<void> {
    const ok = await this.confirm.ask({
      message: `Visszaállítod a(z) „${this.demo().title}” demót? Minden, a bemutató óta végzett munka elvész, a jelszavak megmaradnak; ` +
        'a bejelentkezett felhasználóknak újra be kell lépniük.',
      danger: true,
      confirmLabel: 'Visszaállítás',
    });
    if (ok) this.store.reset(this.demo().id);
  }

  async passwords(): Promise<void> {
    const ok = await this.confirm.ask({
      message: `Új jelszavakat adsz ki a(z) „${this.demo().title}” demó minden fiókjának? A régi jelszavak azonnal érvénytelenek.`,
      confirmLabel: 'Új jelszavak',
    });
    if (ok) this.store.regeneratePasswords(this.demo().id);
  }

  async remove(): Promise<void> {
    const ok = await this.confirm.ask({
      message: `Véglegesen törlöd a(z) „${this.demo().title}” demót? Minden fiók, adat és csapattároló törlődik; ez nem vonható vissza.`,
      danger: true,
      confirmLabel: 'Törlés',
    });
    if (ok) this.store.delete(this.demo().id);
  }
}

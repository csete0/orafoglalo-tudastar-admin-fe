import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminLicenseStore } from '../../../services/admin/admin-license.store';
import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { UtcPipe } from '../../../shared/utc/utc.pipe';

/** Egy licenc foglalt helyei felszabadítással: `<ul app-license-seat-list class="mt-2 …" [licenseId]="…">`. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ul[app-license-seat-list]',
  imports: [DatePipe, UtcPipe],
  template: `
    @for (seat of seats(); track seat.userId) {
      <li class="flex items-center gap-2 flex-wrap">
        <span class="text-text-muted">{{ seat.seatIndex + 1 }}. hely</span>
        <span>{{ seat.displayName || seat.email }}</span>
        <span [class]="seat.isFresh ? 'text-success' : 'text-text-muted'">
          {{ seat.isFresh ? 'aktív' : 'tétlen' }}
        </span>
        <!-- A "Felszabadítás" gomb itt van mellette: az admin előre
             lássa, kinél nem fog végrehajtódni a művelet. -->
        @if (seat.sessionInProgress) {
          <span class="text-warning" title="Vizsga vagy kvíz van folyamatban - a helyét most nem lehet felszabadítani.">
            &middot; vizsgázik/kvízt ír
          </span>
        }
        <span class="text-text-muted">
          utoljára: {{ seat.lastActivityAt | utc | date: 'MM.dd HH:mm' }}
        </span>
        <button
          (click)="confirmRelease(seat.userId, seat.displayName || seat.email)"
          [disabled]="licenseStore.loading()"
          class="btn btn-ghost !px-2 !py-0.5 !text-xs"
        >
          Felszabadítás
        </button>
      </li>
    } @empty {
      <li class="text-text-muted">Jelenleg senki nem használ helyet.</li>
    }
  `,
})
export class LicenseSeatListComponent {
  readonly licenseStore = inject(AdminLicenseStore);
  private readonly confirmService = inject(ConfirmService);

  readonly licenseId = input.required<number>();
  readonly seats = computed(() => this.licenseStore.seats()[this.licenseId()] ?? []);

  async confirmRelease(userId: number, label: string): Promise<void> {
    if (this.licenseStore.loading()) return;

    const ok = await this.confirmService.ask({
      message:
        `Felszabadítod ${label} helyét? A diák visszaesik a saját előfizetésére, ` +
        'a hely pedig azonnal kiosztható másnak.',
      danger: true,
      confirmLabel: 'Felszabadítás',
    });
    if (!ok) return;

    this.licenseStore.releaseSeat(this.licenseId(), userId);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AppStatusService } from '../../services/app-status/app-status.service';
import { latestValue } from '../../shared/resource/latest-value';

@Component({
  selector: 'app-app-status',
  templateUrl: './app-status.component.html',
  styleUrl: './app-status.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppStatusComponent {
  private readonly appStatusService = inject(AppStatusService);
  private readonly status = rxResource({ stream: () => this.appStatusService.getStatus() });
  private readonly latest = latestValue(this.status);

  /** Hiba után a korábbi lista marad. */
  readonly items = computed(() => this.latest() ?? []);
  readonly isLoading = this.status.isLoading;
  // `status()`-ra kötve: a hibaállapotból indított `reload()` alatt az `error()` még a régi hibát adná, az üzenet viszont
  // betöltéskor eltűnik (mint eddig).
  readonly errorMessage = computed(() => (this.status.status() === 'error' ? 'Az állapot-lekérdezés sikertelen.' : null));

  refresh(): void {
    this.status.reload();
  }
}

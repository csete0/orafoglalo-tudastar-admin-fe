import { Component, OnInit, inject, signal } from '@angular/core';
import { AppStatusService, AppStatusResult } from '../../services/app-status/app-status.service';

@Component({
  selector: 'app-app-status',
  standalone: true,
  templateUrl: './app-status.component.html',
  styleUrl: './app-status.component.css',
})
export class AppStatusComponent implements OnInit {
  private readonly appStatusService = inject(AppStatusService);

  readonly items = signal<AppStatusResult[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      this.items.set(await this.appStatusService.getStatus());
    } catch {
      this.errorMessage.set('Az állapot-lekérdezés sikertelen.');
    } finally {
      this.isLoading.set(false);
    }
  }
}

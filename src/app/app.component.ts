import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthStore } from './services/auth/auth.store';
import { ConfirmDialogComponent } from './shared/confirm/confirm-dialog.component';
import { ToastComponent } from './shared/toast/toast.component';
import { ToastService } from './shared/toast/toast.service';
import { HangfireService } from './services/hangfire/hangfire.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmDialogComponent, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly hangfire = inject(HangfireService);
  private readonly toast = inject(ToastService);

  /** Háttérfeladatok (Hangfire dashboard) új lapon - a lapot a kattintásban kell megnyitni (felugró-blokkoló). */
  openHangfire(event: Event): void {
    event.preventDefault();
    this.hangfire.openDashboard().catch(() => this.toast.danger('A háttérfeladatok felülete nem nyitható meg.'));
  }

  logout(): void {
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}

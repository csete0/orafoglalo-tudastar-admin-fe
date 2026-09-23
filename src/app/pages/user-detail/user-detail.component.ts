import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UserService, UserDetail } from '../../services/users/user.service';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './user-detail.component.html',
  styleUrl: './user-detail.component.css',
})
export class UserDetailComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private userId!: number;

  readonly user = signal<UserDetail | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly actionBusy = signal(false);
  readonly actionMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.userId = Number(this.route.snapshot.paramMap.get('id'));
    await this.reload();
    this.isLoading.set(false);
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── A3: három támogatói művelet ─────────────────────────────────

  async unlock(): Promise<void> {
    await this.runAction(() => this.userService.unlock(this.userId), 'Zárolás feloldva.');
  }

  async resendConfirmation(): Promise<void> {
    await this.runAction(
      () => this.userService.resendConfirmation(this.userId),
      'Megerősítő e-mail elküldve.',
    );
  }

  async confirmEmailManually(): Promise<void> {
    // SEC-4 (terv, kétlépcsős megerősítés): ez a diák/tanár fiókjának állapotát
    // közvetlenül módosítja token/link nélkül - admin-oldali megerősítés kell hozzá.
    if (!confirm('Biztosan kézzel megerősíted ennek a felhasználónak az e-mail-címét?')) {
      return;
    }
    await this.runAction(
      () => this.userService.confirmEmailManually(this.userId),
      'E-mail kézzel megerősítve.',
    );
  }

  private async runAction(action: () => Promise<void>, successMessage: string): Promise<void> {
    this.actionBusy.set(true);
    this.actionMessage.set(null);
    try {
      await action();
      this.actionMessage.set(successMessage);
      await this.reload();
    } catch {
      this.actionMessage.set('A művelet sikertelen.');
    } finally {
      this.actionBusy.set(false);
    }
  }

  private async reload(): Promise<void> {
    try {
      this.user.set(await this.userService.getDetail(this.userId));
    } catch {
      this.errorMessage.set('A felhasználó nem található.');
    }
  }
}

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthStore } from '../../services/auth/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.isSubmitting()) return;
    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    try {
      await this.authStore.login(this.email, this.password);
      this.router.navigate(['/']);
    } catch (err) {
      // A backend AdminAuthController SZÁNDÉKOSAN egységes hibaüzenetet ad
      // (BE-LOGIN-USER-ENUMERATION mintája) - itt is azt jelenítjük meg, nem
      // találunk ki sajátot.
      const message =
        err instanceof HttpErrorResponse
          ? (err.error?.errorMessage ?? err.error?.error ?? 'Sikertelen bejelentkezés.')
          : 'Sikertelen bejelentkezés.';
      this.errorMessage.set(message);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}

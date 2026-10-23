import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthStore } from '../../services/auth/auth.store';
import { isRecord } from '../../shared/http-error/extract-error-message.util';

/** A backend hibatestéből az `errorMessage`, ennek híján az `error` mező; különben generikus szöveg. */
function loginErrorMessage(err: unknown): string {
  const body: unknown = err instanceof HttpErrorResponse ? err.error : null;
  if (isRecord(body)) {
    const { errorMessage, error } = body;
    if (typeof errorMessage === 'string') return errorMessage;
    if (typeof error === 'string') return error;
  }
  return 'Sikertelen bejelentkezés.';
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly form = inject(NonNullableFormBuilder).group({ email: '', password: '' });
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.isSubmitting()) return;
    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    try {
      const { email, password } = this.form.getRawValue();
      await this.authStore.login(email, password);
      this.router.navigate(['/']);
    } catch (err) {
      // A backend AdminAuthController SZÁNDÉKOSAN egységes hibaüzenetet ad
      // (BE-LOGIN-USER-ENUMERATION mintája) - itt is azt jelenítjük meg, nem
      // találunk ki sajátot.
      this.errorMessage.set(loginErrorMessage(err));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminDemoStore } from '../../services/admin/admin-demo.store';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';
import { DemoCardComponent } from './demok/demo-card.component';
import { DemoCreateFormComponent } from './demok/demo-create-form.component';
import { DemoCredentialsComponent } from './demok/demo-credentials.component';

/** A saját demó alapértelmezett címalapja (D1: csete6+demo-…@gmail.com). */
export const DEFAULT_OWNER_EMAIL_BASE = 'csete6@gmail.com';

/**
 * Demók (PATRICKS-DEMO-KORNYEZET-TERV.md F5): a saját (éjjel alaphelyzetbe álló) demó és a lejáró iskolai demók kezelése, a belépési
 * adatok egyszeri megjelenítése nyomtatható panelen.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-demok',
  imports: [ReactiveFormsModule, LocalSpinnerComponent, DemoCardComponent, DemoCreateFormComponent, DemoCredentialsComponent],
  template: `
    <div class="max-w-5xl">
      <h1 class="page-title print:hidden">Demók</h1>
      <p class="text-sm text-text-muted mt-1 print:hidden">
        Élő bemutató saját demóval, és lejáró demó-környezet iskoláknak - előre feltöltött adatokkal, kemény MI-kerettel.
      </p>
      <div class="hairline print:hidden"></div>

      @if (store.error(); as error) {
        <p class="text-danger text-sm mb-4" data-testid="demo-page-error">{{ error }}</p>
      }

      <app-demo-credentials class="block mb-6" />

      <section class="mb-8 print:hidden">
        <h2 class="text-lg font-semibold mb-3">Saját demó</h2>
        @if (store.ownerDemo(); as owner) {
          <app-demo-card [demo]="owner" />
        } @else {
          <form class="card p-4 flex flex-wrap gap-3 items-end" [formGroup]="ownerForm" (ngSubmit)="createOwner()" data-testid="owner-form">
            <div class="flex-1 min-w-56">
              <label class="text-xs text-text-muted block mb-1" for="owner-email">Postafiók (a demó-fiókok plusz-címei ide futnak)</label>
              <input id="owner-email" type="email" class="input" formControlName="emailBase" />
            </div>
            <button type="submit" class="btn btn-primary" [disabled]="ownerForm.invalid || store.loading()">Saját demó létrehozása</button>
          </form>
        }
      </section>

      <section class="print:hidden">
        <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 class="text-lg font-semibold">Iskolai demók</h2>
          <app-demo-create-form />
        </div>
        @if (store.loading() && store.demos().length === 0) {
          <app-local-spinner />
        }
        <div class="space-y-3">
          @for (demo of store.schoolDemos(); track demo.id) {
            <app-demo-card [demo]="demo" />
          } @empty {
            <p class="text-sm text-text-muted">Még nincs iskolai demó.</p>
          }
        </div>
      </section>
    </div>
  `,
})
export class AdminDemokComponent {
  readonly store = inject(AdminDemoStore);
  readonly ownerForm = inject(NonNullableFormBuilder).group({
    emailBase: [DEFAULT_OWNER_EMAIL_BASE, [Validators.required, Validators.email]],
  });

  constructor() {
    this.store.load();
  }

  createOwner(): void {
    this.store.createOwner({ emailBase: this.ownerForm.getRawValue().emailBase.trim() }, () => undefined);
  }
}

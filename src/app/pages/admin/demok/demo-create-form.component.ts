import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminDemoStore } from '../../../services/admin/admin-demo.store';

/**
 * Új iskolai demó (PATRICKS-DEMO-KORNYEZET-TERV.md F5): iskola neve, város, lejárat (napokban vagy dátummal), diákszám (4/5).
 * Az űrlap csak sikeres létrehozás után záródik - backend-elutasításnál a begépelt adatok megmaradnak.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-demo-create-form',
  imports: [ReactiveFormsModule],
  template: `
    @if (open()) {
      <form class="card p-4 flex flex-wrap gap-3 items-end" [formGroup]="form" (ngSubmit)="create()" data-testid="demo-create-form">
        <div class="min-w-56 flex-1">
          <label class="text-xs text-text-muted block mb-1" for="demo-title">Iskola neve</label>
          <input id="demo-title" class="input" formControlName="title" placeholder="pl. Szegedi Radnóti Miklós Gimnázium" />
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1" for="demo-city">Város</label>
          <input id="demo-city" class="input !w-40" formControlName="city" placeholder="nem kötelező" />
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1" for="demo-days">Lejárat (nap)</label>
          <input id="demo-days" type="number" min="1" max="120" class="input !w-24" formControlName="days" />
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1" for="demo-until">vagy dátum</label>
          <input id="demo-until" type="date" class="input !w-auto" formControlName="until" />
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1" for="demo-students">Diákok</label>
          <select id="demo-students" class="input !w-auto" formControlName="studentCount">
            <option [ngValue]="5">5</option>
            <option [ngValue]="4">4</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" [disabled]="form.invalid || store.loading()">Létrehozás</button>
        <button type="button" class="btn btn-ghost" (click)="open.set(false)">Mégse</button>
      </form>
    } @else {
      <button type="button" class="btn btn-primary" (click)="start()" data-testid="demo-new">+ Új iskolai demó</button>
    }
  `,
})
export class DemoCreateFormComponent {
  readonly store = inject(AdminDemoStore);
  readonly open = signal(false);

  readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(180)]],
    city: [''],
    days: [14, [Validators.min(1), Validators.max(120)]],
    until: [''],
    studentCount: [5 as 4 | 5],
  });

  start(): void {
    this.store.clearError();
    this.form.reset();
    this.open.set(true);
  }

  create(): void {
    const { title, city, days, until, studentCount } = this.form.getRawValue();
    this.store.createSchool(
      {
        title: title.trim(),
        city: city.trim() || null,
        days: until ? null : days,
        // A dátum a magyar nap végéig érvényes (23:59 helyi idő).
        expiresAt: until ? new Date(`${until}T23:59:00`).toISOString() : null,
        studentCount,
      },
      () => this.open.set(false),
    );
  }
}

import { ChangeDetectionStrategy, Component, OnInit, inject, input, model } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AdminLicenseStore } from '../../../services/admin/admin-license.store';
import { AdminSchoolStore } from '../../../services/admin/admin-school.store';

/**
 * „+ Új licenc” gomb és űrlap egy intézményhez: `<app-license-create-form [schoolId]="…" [(openSchoolId)]="…" />`.
 * Az `openSchoolId` oldal-szintű: egyszerre egy intézménynél lehet nyitva. A gazda-elem `display: contents`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-license-create-form',
  imports: [ReactiveFormsModule],
  styles: ':host { display: contents; }',
  template: `
    <button (click)="start()" class="btn btn-ghost !px-2 !py-1 !text-xs mt-1">
      + Új licenc
    </button>

    @if (openSchoolId() === schoolId()) {
      <div class="mt-2 flex flex-wrap gap-2 items-end" [formGroup]="form">
        <div>
          <label class="text-xs text-text-muted block mb-1">Csomag</label>
          <select formControlName="tier" [attr.name]="'tier-' + schoolId()" class="input !w-auto !text-xs">
            <option value="standard">Standard</option>
            <option value="premium">Prémium</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1">Helyek</label>
          <input type="number" min="0" formControlName="capacity" [attr.name]="'cap-' + schoolId()"
                 class="input !w-20 !text-xs" />
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1">Érvényes-tól</label>
          <input type="date" formControlName="validFrom" [attr.name]="'from-' + schoolId()"
                 class="input !w-auto !text-xs" />
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1">Érvényes-ig</label>
          <input type="date" formControlName="validTo" [attr.name]="'to-' + schoolId()"
                 class="input !w-auto !text-xs" />
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1">Számlázási megjegyzés</label>
          <input type="text" formControlName="billingNote" [attr.name]="'note-' + schoolId()"
                 placeholder="pl. fenntartó neve, számlaszám"
                 class="input !w-56 !text-xs" />
        </div>
        <button (click)="create()" [disabled]="licenseStore.loading()" class="btn btn-primary !px-3 !py-1 !text-xs">
          Létrehozás
        </button>
        <button (click)="cancel()" class="btn btn-ghost !px-3 !py-1 !text-xs">
          Mégse
        </button>
      </div>
    }
  `,
})
export class LicenseCreateFormComponent implements OnInit {
  readonly licenseStore = inject(AdminLicenseStore);
  private readonly schoolStore = inject(AdminSchoolStore);

  readonly schoolId = input.required<number>();
  /** Annak az intézménynek az id-je, amelyiknél az oldalon épp nyitva van az űrlap. */
  readonly openSchoolId = model<number | null>(null);

  readonly form = inject(NonNullableFormBuilder).group({
    tier: 'premium',
    capacity: 30,
    validFrom: '',
    validTo: '',
    billingNote: '',
  });

  /** Megnyitja (vagy újranyitja) az űrlapot értelmes alapértékekkel: a mai naptól egy tanévnyi időre. */
  start(): void {
    this.openSchoolId.set(this.schoolId());
    this.licenseStore.clearError();
    this.resetToDefaults();
  }

  // A nyitott állapot oldal-szintű, a komponens viszont újra létrejöhet (pl. a szűrő ki-be kapcsolásakor): ilyenkor a
  // nyitott űrlap ne üres dátumokkal jelenjen meg, hanem az alapértékekkel.
  ngOnInit(): void {
    if (this.openSchoolId() === this.schoolId()) this.resetToDefaults();
  }

  private resetToDefaults(): void {
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    this.form.setValue({
      tier: 'premium',
      capacity: 30,
      validFrom: toDateInput(today),
      validTo: toDateInput(nextYear),
      billingNote: '',
    });
  }

  cancel(): void {
    this.openSchoolId.set(null);
  }

  // UI-TT-208: az űrlap KIZÁRÓLAG a store `onSuccess` callback-jéből zár - backend-elutasításnál (pl. felcserélt
  // validFrom/validTo) a begépelt adatok megmaradnak.
  create(): void {
    if (this.licenseStore.loading()) return;

    const { tier, capacity, validFrom, validTo, billingNote } = this.form.getRawValue();
    this.licenseStore.create(
      { schoolId: this.schoolId(), tier, capacity, validFrom, validTo, billingNote: billingNote.trim() || null },
      () => {
        this.openSchoolId.set(null);
        this.schoolStore.load(); // a „Nyilvános (licenc alapján)” jelölés a licenctől függ
      },
    );
  }
}

// BE-INSTLICENSEADMIN-CREATEFORM-LOCALMIDNIGHT-UTCDATE: a `toISOString()` UTC-re konvertál, ezért helyi éjfél után,
// UTC éjfél előtt a "mai nap" alapértelmezés a TEGNAPI dátumot töltötte be. A HELYI naptári napot kell kiírni.
function toDateInput(date: Date): string {
  const ev = date.getFullYear();
  const ho = String(date.getMonth() + 1).padStart(2, '0');
  const nap = String(date.getDate()).padStart(2, '0');
  return `${ev}-${ho}-${nap}`;
}

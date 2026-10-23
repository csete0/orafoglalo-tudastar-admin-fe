import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AdminLicenseStore } from '../../../services/admin/admin-license.store';
import { AdminSchoolStore } from '../../../services/admin/admin-school.store';
import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { InstitutionalLicenseDto } from '../../../models/institutional-license.model';
import { LicenseSeatListComponent } from './license-seat-list.component';
import { LicenseUsagePanelComponent } from './license-usage-panel.component';

/**
 * Egy licenc-keret sora (adatok, helyek, kihasználtság, szerkesztés, visszavonás):
 * `<div app-school-license-card class="text-xs mb-2" [license]="…" [(editingId)]="…" [(seatsId)]="…" [(usageId)]="…">`.
 * A három `model` oldal-szintű: egyszerre csak egy licenc szerkesztő formja, hely-listája és kimutatása lehet nyitva.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'div[app-school-license-card]',
  imports: [DatePipe, ReactiveFormsModule, LicenseSeatListComponent, LicenseUsagePanelComponent],
  template: `
    <span class="font-semibold">{{ tierLabel() }}</span>
    ·
    <span [class.text-danger]="license().usedSeats >= license().capacity">
      {{ license().usedSeats }}/{{ license().capacity }} hely használatban
    </span>
    @if (license().heldSeats > license().usedSeats) {
      <span class="text-text-muted">
        ({{ license().heldSeats - license().usedSeats }} tétlen, átadható)
      </span>
    }
    <br />
    <span class="text-text-muted">
      {{ license().validFrom | date: 'yyyy.MM.dd' }} –
      {{ license().validTo | date: 'yyyy.MM.dd' }}
      @if (!license().isActive) {
        · <span class="text-danger">{{ license().revokedAt ? 'visszavonva' : 'nem aktív' }}</span>
      }
    </span>
    @if (license().billingNote) {
      <br />
      <span class="text-text-muted">Számlázás: {{ license().billingNote }}</span>
    }

    <!-- UI-TT-206: a Visszavonás/Felszabadítás gombok NEM a szerkesztéshez kötöttek -
         BÁRMELYIK licenc kártyáján elérhetők, függetlenül attól, hogy épp melyik licenc
         szerkesztő formja van nyitva. Ezért a hibájuk is ITT, a saját licenc-kártyájuk alatt
         jelenik meg - nem a globális sávban, és semmiképp sem egy másik, épp nyitva hagyott
         licenc szerkesztő formja alatt. -->
    @if (cardError()) {
      <p class="text-danger text-xs mt-1">{{ licenseStore.error() }}</p>
    }

    <div class="flex gap-2 mt-1 flex-wrap">
      <button (click)="toggleSeats()" class="btn btn-ghost !px-2 !py-1 !text-xs">
        {{ seatsOpen() ? 'Helyek elrejtése' : 'Helyek megtekintése' }}
      </button>
      <button (click)="toggleUsage()" class="btn btn-ghost !px-2 !py-1 !text-xs">
        {{ usageOpen() ? 'Kimutatás elrejtése' : 'Kihasználtság' }}
      </button>
      @if (!license().revokedAt) {
        <button (click)="startEdit()" [disabled]="licenseStore.loading()" class="btn btn-ghost !px-2 !py-1 !text-xs">
          Szerkesztés
        </button>
        <button (click)="confirmRevoke()" [disabled]="licenseStore.loading()" class="btn btn-danger !px-2 !py-1 !text-xs">
          Visszavonás
        </button>
      }
    </div>

    @if (editing()) {
      <div class="mt-2 flex flex-wrap gap-2 items-end border-t border-border-default pt-2" [formGroup]="editForm">
        <!-- UI-TT-201: a mentés-hiba itt, a szerkesztett licenc mellett is megjelenik (egy hosszú
             intézmény-listán a lap tetején görgetés nélkül nem látszana).
             UI-TT-206: DE csak akkor, ha a hiba TÉNYLEGESEN ennek a licencnek a mentési
             kísérletéből származik - egy másik licenc visszavonási/felszabadítási hibája nem
             kerülhet egy érintetlen licenc nyitott formája alá. -->
        @if (editFormError()) {
          <p class="text-danger text-xs w-full mb-1">{{ licenseStore.error() }}</p>
        }
        <div>
          <label class="text-xs text-text-muted block mb-1">Helyek</label>
          <input type="number" min="0" formControlName="capacity" [attr.name]="'edit-cap-' + license().id"
                 class="input !w-20 !text-xs" />
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1">Érvényes-tól</label>
          <input type="date" formControlName="validFrom" [attr.name]="'edit-from-' + license().id"
                 class="input !w-auto !text-xs" />
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1">Érvényes-ig</label>
          <input type="date" formControlName="validTo" [attr.name]="'edit-to-' + license().id"
                 class="input !w-auto !text-xs" />
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1">Tétlenségi ablak (perc)</label>
          <input type="number" min="0" formControlName="idleWindowMinutes" [attr.name]="'edit-idle-' + license().id"
                 class="input !w-24 !text-xs" />
        </div>
        <div>
          <label class="text-xs text-text-muted block mb-1">Számlázási megjegyzés</label>
          <input type="text" formControlName="billingNote" [attr.name]="'edit-note-' + license().id"
                 placeholder="pl. fenntartó neve, számlaszám"
                 class="input !w-56 !text-xs" />
        </div>
        <button (click)="saveEdit()" [disabled]="licenseStore.loading()" class="btn btn-primary !px-3 !py-1 !text-xs">
          Mentés
        </button>
        <button (click)="cancelEdit()" class="btn btn-ghost !px-3 !py-1 !text-xs">
          Mégse
        </button>
      </div>
    }

    @if (seatsOpen()) {
      <ul app-license-seat-list class="mt-2 space-y-1" [licenseId]="license().id"></ul>
    }

    @if (usageOpen()) {
      @if (licenseStore.usage()[license().id]; as usage) {
        <div app-license-usage-panel class="mt-2 border-t border-border-default pt-2" [usage]="usage"></div>
      } @else {
        <p class="text-text-muted mt-2">Kimutatás betöltése…</p>
      }
    }
  `,
})
export class SchoolLicenseCardComponent {
  readonly licenseStore = inject(AdminLicenseStore);
  private readonly schoolStore = inject(AdminSchoolStore);
  private readonly confirmService = inject(ConfirmService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly license = input.required<InstitutionalLicenseDto>();
  /** Az oldalon épp szerkesztett licenc id-je (egyszerre egy). */
  readonly editingId = model<number | null>(null);
  /** Az oldalon épp nyitott hely-lista licencének id-je (egyszerre egy). */
  readonly seatsId = model<number | null>(null);
  /** Az oldalon épp nyitott kihasználtsági kimutatás licencének id-je (egyszerre egy). */
  readonly usageId = model<number | null>(null);

  readonly editing = computed(() => this.editingId() === this.license().id);
  readonly seatsOpen = computed(() => this.seatsId() === this.license().id);
  readonly usageOpen = computed(() => this.usageId() === this.license().id);
  readonly tierLabel = computed(() => tierLabel(this.license().tier));

  readonly editForm = this.fb.group({
    capacity: 0,
    validFrom: '',
    validTo: '',
    idleWindowMinutes: this.fb.control<number | null>(null),
    billingNote: '',
  });

  // UI-TT-206: a Visszavonás/Felszabadítás hiba a MŰVELET CÉL-licencének kártyáján jelenik meg - függetlenül attól,
  // hogy épp melyik (akár egy MÁSIK) licenc szerkesztő formja van nyitva. Az `errorLicenseId` a store-ban a mutáló
  // hívás licenc-id-jével kerül beállításra.
  readonly cardError = computed(() => {
    if (!this.licenseStore.error()) return false;
    const source = this.licenseStore.errorSource();
    return (source === 'revoke' || source === 'releaseSeat') && this.licenseStore.errorLicenseId() === this.license().id;
  });

  // UI-TT-206: a nyitott szerkesztő form alatti hiba KIZÁRÓLAG akkor jelenik meg, ha TÉNYLEGESEN ennek a licencnek a
  // mentési kísérletéből (`update()`) származik - nem elég, hogy épp ez a form van nyitva.
  readonly editFormError = computed(
    () =>
      !!this.licenseStore.error() &&
      this.licenseStore.errorSource() === 'edit' &&
      this.licenseStore.errorLicenseId() === this.license().id,
  );

  toggleSeats(): void {
    const id = this.license().id;
    if (this.seatsOpen()) {
      this.seatsId.set(null);
      return;
    }
    this.seatsId.set(id);
    this.licenseStore.loadSeats(id);
  }

  toggleUsage(): void {
    const id = this.license().id;
    if (this.usageOpen()) {
      this.usageId.set(null);
      return;
    }
    this.usageId.set(id);
    this.licenseStore.loadUsage(id);
  }

  // UI-TT-198: a MEGLÉVŐ licencet szerkesztő inline form (kapacitás/érvényesség/idle-window/számlázási megjegyzés) -
  // a korábbi workaround (Visszavonás + Új licenc) azonnal kirúgta a nem-vizsgázó diákokat és nullázta a
  // kihasználtsági előzményt egy vadonatúj licenc-id alatt.
  startEdit(): void {
    const license = this.license();
    this.editingId.set(license.id);
    this.licenseStore.clearError();
    this.editForm.setValue({
      capacity: license.capacity,
      validFrom: license.validFrom.slice(0, 10),
      validTo: license.validTo.slice(0, 10),
      idleWindowMinutes: license.idleWindowMinutes,
      billingNote: license.billingNote ?? '',
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  // UI-TT-199: a form KIZÁRÓLAG a store sikeres callback-jéből zár. Hiba esetén (pl. felcserélt validFrom/validTo,
  // ütköző rowVersion) a callback sosem fut le, a form nyitva marad a begépelt értékekkel, hogy az admin csak a hibás
  // mezőt javítsa.
  saveEdit(): void {
    if (this.licenseStore.loading()) return;

    const license = this.license();
    const { capacity, validFrom, validTo, idleWindowMinutes, billingNote } = this.editForm.getRawValue();
    this.licenseStore.update(
      license.id,
      {
        capacity,
        validFrom,
        validTo,
        billingNote: billingNote.trim() || null,
        idleWindowMinutes,
        // Konkurrencia-token a betöltött licencből - ütközésnél a backend elutasít.
        rowVersion: license.rowVersion,
      },
      (updated) => {
        this.editingId.set(null);
        this.schoolStore.load(); // az érvényesség a „Nyilvános (licenc alapján)” jelölést is változtathatja
        this.warnIfSeatsSkipped(updated.skippedDueToActiveSessionCount);
      },
    );
  }

  async confirmRevoke(): Promise<void> {
    if (this.licenseStore.loading()) return;

    const license = this.license();
    const ok = await this.confirmService.ask({
      message:
        `Biztosan visszavonod a(z) ${tierLabel(license.tier)} licencet ` +
        `(${license.ownerName})? A jelenleg használt ${license.heldSeats} hely azonnal ` +
        'felszabadul, az érintett diákok visszaesnek a saját előfizetésükre.',
      danger: true,
      confirmLabel: 'Visszavonás',
    });
    if (!ok) return;

    // UI-TT-200: a dialógus feltétel nélkül ígéri, hogy MINDEN hely felszabadul - ez szándékosan nem igaz, ha egy diák
    // épp vizsgázik/kvízt ír (a backend kihagyja a helyét). A callback-ből mutatott toast korrigálja ezt.
    this.licenseStore.revoke(license.id, (result) => {
      this.schoolStore.load();
      this.warnIfSeatsSkipped(result.skippedDueToActiveSessionCount);
    });
  }

  private warnIfSeatsSkipped(skippedCount: number): void {
    if (skippedCount <= 0) return;

    this.toastService.warning(
      `${skippedCount} hely nem szabadult fel - a diák épp vizsgázik/kvízt ír, ` +
        'a hely csak a munkamenet végeztével válik felszabadíthatóvá.',
    );
  }
}

function tierLabel(tier: string): string {
  return tier === 'premium' ? 'Prémium' : 'Standard';
}

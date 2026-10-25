import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminSchoolStore } from '../../services/admin/admin-school.store';
import { AdminLicenseStore } from '../../services/admin/admin-license.store';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { LocalSpinnerComponent } from '../../shared/local-spinner/local-spinner.component';
import { UtcPipe } from '../../shared/utc/utc.pipe';
import { SchoolAdminDto } from '../../models/teacher-moderation.model';
import { LicenseCreateFormComponent } from './intezmenyek/license-create-form.component';
import { SchoolLicenseCardComponent } from './intezmenyek/school-license-card.component';
import { SchoolMergePanelComponent } from './intezmenyek/school-merge-panel.component';
import { schoolLabel } from './intezmenyek/school-label';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-intezmenyek',
  imports: [
    DatePipe,
    IconComponent,
    LocalSpinnerComponent,
    UtcPipe,
    SchoolMergePanelComponent,
    SchoolLicenseCardComponent,
    LicenseCreateFormComponent,
  ],
  template: `
    <div class="max-w-5xl">
      <h1 class="page-title">Intézmények (admin)</h1>
      <p class="text-sm text-text-muted mt-1">
        Intézmények áttekintése, duplikátumok egyesítése és licenc-keretek kezelése
      </p>
      <div class="hairline"></div>

      @if (store.lastMergeResult(); as result) {
        <div class="bg-success-subtle border border-success/40 rounded-xl p-4 mb-4 text-sm">
          <p class="text-success font-bold mb-1">Egyesítés sikeres.</p>
          <p class="text-text-muted">
            {{ result.movedGroups }} csoport, {{ result.movedMemberships }} tagság átkerült
            @if (result.mergedDuplicateMemberships > 0) {
              , {{ result.mergedDuplicateMemberships }} átfedő tagság összevonva
            }.
          </p>
        </div>
      }

      @if (store.error()) {
        <p class="text-danger text-sm mb-4">{{ store.error() }}</p>
      }

      <!-- UI-TT-201/UI-TT-206: ez a globális hely csak akkor mutatja a hibát, ha az NEM
           tartozik már megjelenítve valahova máshoz - vagyis nem a jelenleg nyitott
           szerkesztő form MENTÉSI hibája (az a szerkesztett licenc kártyája MELLETT jelenik
           meg, ld. school-license-card), és nem egy konkrét licenc visszavonási/felszabadítási
           hibája (az a MAGA licenc kártyáján jelenik meg). licenseStore.error() egy
           EGYETLEN, megosztott signal minden licenc-műveletre (admin-license.store.ts) -
           errorSource/errorLicenseId mondja meg, MELYIK művelet/licenc okozta, hogy a
           hiba ne kerülhessen tévesen egy másik, épp nyitva hagyott szerkesztő form alá
           (UI-TT-206: egy B licenc visszavonási hibája korábban A licenc nyitott formája
           alatt jelent meg, ha A formja épp nyitva volt). -->
      @if (licenseStore.error() && !isLicenseErrorHandledInline()) {
        <p class="text-danger text-sm mb-4">{{ licenseStore.error() }}</p>
      }

      @if (store.loading()) {
        <app-local-spinner />
      }

      <div app-school-merge-panel class="card p-5 mb-6"></div>

      <label class="inline-flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" [checked]="onlyPendingPublic()" (change)="onlyPendingPublic.set(!onlyPendingPublic())"
               data-testid="only-pending-public" />
        Csak a próbaérettségi-jóváhagyásra várók ({{ pendingPublicCount() }})
      </label>

      <ul class="space-y-3">
        @for (school of visibleSchools(); track school.id) {
          <li class="card p-4 flex gap-3">
            <div class="icon-tile icon-tile-primary">
              <app-icon name="building" class="w-6 h-6 block" />
            </div>
            <div class="min-w-0">
              <p class="font-medium truncate">
                {{ school.name }}
                @if (school.isDemo) {
                  <span class="badge badge-warning" data-testid="school-demo-badge">Demó</span>
                }
              </p>
              @if (school.city) {
                <p class="text-sm text-text-muted truncate">{{ school.city }}</p>
              }
              @if (school.adminDisplayNames.length > 0) {
                <p class="text-sm text-text-muted break-words">Igazgató: {{ school.adminDisplayNames.join(', ') }}</p>
              }
              <p class="text-xs text-text-muted mt-1">
                {{ school.teacherCount }} tanár · {{ school.groupCount }} csoport ·
                létrehozva {{ school.createdAt | utc | date: 'yyyy.MM.dd' }}
                @if (school.createdByName || school.createdByEmail) {
                  · {{ school.createdByName }}@if (school.createdByEmail) { ({{ school.createdByEmail }})}
                }
              </p>

              <!-- Próbaérettségi iskolakereső (BE: MockExamSchools): licenccel automatikusan nyilvános,
                   licenc nélkül csak admin-jóváhagyással - a tanárok tetszőleges névvel hozhatnak létre intézményt. -->
              <div class="mt-2 flex items-center gap-2 flex-wrap text-xs" [attr.data-testid]="'public-approval-' + school.id">
                @if (school.isDemo) {
                  <span class="badge badge-neutral">Nem nyilvános (demó)</span>
                } @else if (school.hasLicense) {
                  <span class="badge badge-success">Nyilvános (licenc alapján)</span>
                } @else {
                  <label class="inline-flex items-center gap-1.5">
                    <input type="checkbox" [checked]="!!school.publicApprovedAt" [disabled]="store.loading()"
                           (click)="$event.preventDefault(); confirmPublicToggle(school)" />
                    Nyilvános (próbaérettségi)
                  </label>
                  @if (school.publicApprovedAt) {
                    <span class="text-text-muted">
                      jóváhagyva {{ school.publicApprovedAt | utc | date: 'yyyy.MM.dd' }}@if (school.publicApprovedByEmail) {, {{ school.publicApprovedByEmail }}}
                    </span>
                  } @else {
                    <span class="badge badge-warning">jóváhagyásra vár</span>
                  }
                }
                <span class="text-text-muted">· {{ school.mockExamRegistrationCount }} próbaérettségi-jelentkezés</span>
              </div>

              <!-- Licenc-keretek: az intézményhez tartoznak, ezért itt jelennek meg,
                   nem külön menüpontban (a fejléc-navigáció 6 linkre van méretezve,
                   ld. UI-TT-181/192/177). -->
              <div class="mt-3 pt-3 border-t border-border-default">
                @for (license of licenseStore.licensesForSchool(school.id); track license.id) {
                  <div app-school-license-card class="text-xs mb-2" [license]="license"
                       [(editingId)]="editingLicenseId" [(seatsId)]="seatsLicenseId" [(usageId)]="usageLicenseId"></div>
                } @empty {
                  <p class="text-xs text-text-muted">Nincs licenc-keret ehhez az intézményhez.</p>
                }

                <app-license-create-form [schoolId]="school.id" [(openSchoolId)]="newLicenseSchoolId" />
              </div>
            </div>
          </li>
        } @empty {
          @if (!store.loading()) {
            <li class="flex flex-col items-center py-10 gap-3">
              <div class="icon-tile icon-tile-neutral">
                <app-icon name="building" class="w-6 h-6 block" />
              </div>
              <p class="font-semibold">Nincs még intézmény.</p>
            </li>
          }
        }
      </ul>
    </div>
  `,
})
export class AdminIntezmenyekComponent {
  readonly store = inject(AdminSchoolStore);
  readonly licenseStore = inject(AdminLicenseStore);
  private readonly confirmService = inject(ConfirmService);

  /** Licenc nélküli, még nem jóváhagyott intézmények - ezek nem látszanak a próbaérettségi iskolakeresőben. */
  readonly onlyPendingPublic = signal(false);
  readonly pendingPublicCount = computed(() => this.store.schools().filter(isPendingPublic).length);
  readonly visibleSchools = computed(() =>
    this.onlyPendingPublic() ? this.store.schools().filter(isPendingPublic) : this.store.schools(),
  );

  // Oldal-szintű nyitott állapotok: egyszerre egy szerkesztő form, egy hely-lista, egy kimutatás és egy új-licenc űrlap.
  readonly editingLicenseId = signal<number | null>(null);
  readonly seatsLicenseId = signal<number | null>(null);
  readonly usageLicenseId = signal<number | null>(null);
  readonly newLicenseSchoolId = signal<number | null>(null);

  // UI-TT-206: a globális hiba-sáv (a komponens tetején) csak akkor legyen elnyomva, ha a
  // hibát MÁR megjelenítjük valahol máshol - vagy a jelenleg nyitott szerkesztő form
  // MENTÉSI hibájaként, vagy egy konkrét licenc-kártya visszavonási/felszabadítási
  // hibájaként (ld. school-license-card). Minden más esetben (pl. `load()`/`create()`/
  // `loadSeats()`/`loadUsage()` hiba) a globális sáv az EGYETLEN hely, ahol a hiba látszana -
  // azt nem szabad elnyomni, akkor sem, ha épp nyitva van egy (a hibától független) form.
  readonly isLicenseErrorHandledInline = computed(() => {
    const source = this.licenseStore.errorSource();
    if (source === 'edit') {
      return this.licenseStore.errorLicenseId() === this.editingLicenseId();
    }
    return source === 'revoke' || source === 'releaseSeat';
  });

  constructor() {
    this.store.load();
    this.licenseStore.load();
  }

  // A checkbox kattintása önmagában nem vált (preventDefault a sablonban): a valódi állapot a
  // megerősítés és a sikeres mentés utáni újratöltésből jön.
  async confirmPublicToggle(school: SchoolAdminDto): Promise<void> {
    if (this.store.loading() || school.hasLicense) return;

    const approve = !school.publicApprovedAt;
    const label = schoolLabel(school);
    const ok = await this.confirmService.ask({
      message: approve
        ? `Jóváhagyod a(z) „${label}” intézményt? Megjelenik a próbaérettségi nyilvános iskolakeresőjében és ` +
          'iskola-összesítőjében. Csak valódi, ellenőrzött iskolát hagyj jóvá.'
        : `Visszavonod a(z) „${label}” jóváhagyását? Nem lesz választható a próbaérettségi iskolakeresőben, ` +
          'és kikerül a nyilvános iskola-összesítőből (a meglévő jelentkezések megmaradnak).',
      danger: !approve,
      confirmLabel: approve ? 'Jóváhagyás' : 'Visszavonás',
    });
    if (!ok) return;

    this.store.setPublicApproval(school.id, approve);
  }
}

function isPendingPublic(school: SchoolAdminDto): boolean {
  return !school.hasLicense && !school.publicApprovedAt;
}

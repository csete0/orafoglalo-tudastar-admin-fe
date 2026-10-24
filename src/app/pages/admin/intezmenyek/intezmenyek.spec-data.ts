import { Provider, signal } from '@angular/core';
import { AdminSchoolStore } from '../../../services/admin/admin-school.store';
import { AdminLicenseStore } from '../../../services/admin/admin-license.store';
import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { SchoolAdminDto } from '../../../models/teacher-moderation.model';
import { InstitutionalLicenseDto } from '../../../models/institutional-license.model';

/** Közös teszt-adatok és store-mockok az Intézmények oldal és gyerek-komponensei spec-jeihez. */
export function makeSchool(overrides: Partial<SchoolAdminDto> = {}): SchoolAdminDto {
  return {
    id: 1,
    name: 'Forrás Gimnázium',
    createdAt: new Date().toISOString(),
    teacherCount: 2,
    groupCount: 3,
    adminDisplayNames: [],
    createdByName: null,
    createdByEmail: null,
    hasLicense: false,
    publicApprovedAt: null,
    publicApprovedByEmail: null,
    mockExamRegistrationCount: 0,
    ...overrides,
  };
}

export function makeLicense(overrides: Partial<InstitutionalLicenseDto> = {}): InstitutionalLicenseDto {
  return {
    id: 10,
    schoolId: 1,
    teacherProfileId: null,
    ownerName: 'Forrás Gimnázium',
    tier: 'premium',
    capacity: 30,
    usedSeats: 12,
    heldSeats: 14,
    validFrom: '2026-08-25',
    validTo: '2027-08-25',
    idleWindowMinutes: 20,
    revokedAt: null,
    billingNote: null,
    createdAt: '2026-08-25T00:00:00Z',
    isActive: true,
    skippedDueToActiveSessionCount: 0,
    ...overrides,
  };
}

export interface IntezmenyekMocks {
  storeMock: {
    schools: ReturnType<typeof signal<SchoolAdminDto[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    lastMergeResult: ReturnType<typeof signal<unknown>>;
    load: ReturnType<typeof vi.fn>;
    merge: ReturnType<typeof vi.fn>;
    setPublicApproval: ReturnType<typeof vi.fn>;
  };
  licenseStoreMock: {
    licenses: ReturnType<typeof signal<InstitutionalLicenseDto[]>>;
    seats: ReturnType<typeof signal<Record<number, unknown>>>;
    usage: ReturnType<typeof signal<Record<number, unknown>>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    errorSource: ReturnType<typeof signal<string | null>>;
    errorLicenseId: ReturnType<typeof signal<number | null>>;
    licensesForSchool: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
    loadSeats: ReturnType<typeof vi.fn>;
    loadUsage: ReturnType<typeof vi.fn>;
    clearError: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
    releaseSeat: ReturnType<typeof vi.fn>;
  };
  confirmServiceMock: { ask: ReturnType<typeof vi.fn> };
  toastServiceMock: { success: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  providers: Provider[];
}

export function createIntezmenyekMocks(
  schools: SchoolAdminDto[] = [makeSchool({ id: 1, name: 'Forrás' }), makeSchool({ id: 2, name: 'Cél' })],
  licenses: InstitutionalLicenseDto[] = [],
): IntezmenyekMocks {
  const storeMock: IntezmenyekMocks['storeMock'] = {
    schools: signal(schools),
    loading: signal(false),
    error: signal(null),
    lastMergeResult: signal(null),
    load: vi.fn(),
    merge: vi.fn(),
    setPublicApproval: vi.fn(),
  };
  const licenseStoreMock: IntezmenyekMocks['licenseStoreMock'] = {
    licenses: signal(licenses),
    seats: signal({}),
    usage: signal({}),
    loading: signal(false),
    error: signal(null),
    // UI-TT-206: a valódi store minden mutáló hívás hibáján beállítja, MELYIK
    // művelet ('edit'/'revoke'/'releaseSeat'/...) és MELYIK licenc-id okozta a
    // jelenlegi `error()`-t - a komponensek ez alapján döntik el, HOVA irányítsák a
    // megjelenítést. Az egyes tesztek update()/revoke()/releaseSeat() implementációi ezt
    // a valódi store viselkedését szimulálják hiba-ág esetén.
    errorSource: signal(null),
    errorLicenseId: signal(null),
    licensesForSchool: vi.fn((schoolId: number) => licenses.filter((l) => l.schoolId === schoolId)),
    load: vi.fn(),
    loadSeats: vi.fn(),
    loadUsage: vi.fn(),
    clearError: vi.fn(),
    create: vi.fn(),
    // A valódi store `of()`-fal (RxJS-szel) SZINKRON emittál - az onSuccess callback
    // alapból, mint egy sikeres HTTP-válasz, azonnal lefut a frissített DTO-val. Az
    // egyes tesztek felülírhatják, ha hiba-ágat (callback NEM hívása) akarnak szimulálni.
    update: vi.fn((id: number, request: unknown, onSuccess?: (license: InstitutionalLicenseDto) => void) => {
      onSuccess?.(makeLicense({ id, ...(request as object) }));
    }),
    revoke: vi.fn(
      (_id: number, onSuccess?: (result: { releasedCount: number; skippedDueToActiveSessionCount: number }) => void) => {
        onSuccess?.({ releasedCount: 1, skippedDueToActiveSessionCount: 0 });
      },
    ),
    releaseSeat: vi.fn(),
  };
  const confirmServiceMock = { ask: vi.fn().mockResolvedValue(true) };
  const toastServiceMock = { success: vi.fn(), warning: vi.fn() };
  return {
    storeMock,
    licenseStoreMock,
    confirmServiceMock,
    toastServiceMock,
    providers: [
      { provide: AdminSchoolStore, useValue: storeMock },
      { provide: AdminLicenseStore, useValue: licenseStoreMock },
      { provide: ConfirmService, useValue: confirmServiceMock },
      { provide: ToastService, useValue: toastServiceMock },
    ],
  };
}

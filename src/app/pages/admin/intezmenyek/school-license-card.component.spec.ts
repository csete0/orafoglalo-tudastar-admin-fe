import { TestBed } from '@angular/core/testing';
import { SchoolLicenseCardComponent } from './school-license-card.component';
import { IntezmenyekMocks, createIntezmenyekMocks, makeLicense, makeSchool } from './intezmenyek.spec-data';
import { InstitutionalLicenseDto } from '../../../models/institutional-license.model';

describe('SchoolLicenseCardComponent', () => {
  let mocks: IntezmenyekMocks;

  function configure(licenses: InstitutionalLicenseDto[] = []) {
    mocks = createIntezmenyekMocks([makeSchool({ id: 1 })], licenses);
    TestBed.configureTestingModule({ imports: [SchoolLicenseCardComponent], providers: mocks.providers });
  }

  function create(license: InstitutionalLicenseDto = makeLicense({ id: 42 })) {
    const fixture = TestBed.createComponent(SchoolLicenseCardComponent);
    fixture.componentRef.setInput('license', license);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  // UI-TT-198: az AdminLicenseStore.update() (kapacitás/érvényesség/idle-window/
  // számlázási megjegyzés módosítása egy MEGLÉVŐ licencen) teljes körűen elkészült
  // a store és a service oldalon, de az admin-felület SOHA nem hívta meg - kizárólag
  // Create/Revoke/ReleaseSeat műveleteket vezetett be. Ld. a hunter proof-tesztjét:
  // bug-hunt/2026-08-26-uitt198-no-license-edit-ui, commit db9f8b7.
  it('BUG UI-TT-198 (javítva): van szerkesztés-képesség (startEdit) a licenc-kártyán egy MEGLÉVŐ licenchez', () => {
    configure();
    const { component } = create();

    const instance = component as unknown as Record<string, unknown>;
    const hasEditCapability = [
      'startEdit',
      'startEditLicense',
      'editLicense',
      'updateLicense',
      'saveLicenseEdit',
      'openEditLicense',
    ].some((name) => typeof instance[name] === 'function');

    expect(hasEditCapability).toBe(true);
  });

  it('a "Szerkesztés" gomb minden aktív (nem visszavont) licenc-kártyán megjelenik', () => {
    configure();
    const { fixture } = create(makeLicense({ id: 10, schoolId: 1, revokedAt: null }));

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const editButton = buttons.find((b) => b.textContent?.trim() === 'Szerkesztés');
    expect(editButton).toBeTruthy();
  });

  it('visszavont licencen NEM jelenik meg a "Szerkesztés" gomb', () => {
    configure();
    const { fixture } = create(makeLicense({ id: 10, schoolId: 1, revokedAt: '2026-08-20T00:00:00Z', isActive: false }));

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const editButton = buttons.find((b) => b.textContent?.trim() === 'Szerkesztés');
    expect(editButton).toBeFalsy();
  });

  it('startEdit() a licenc jelenlegi adataival tölti fel a szerkesztő form mezőit', () => {
    configure();
    const { component } = create(
      makeLicense({
        id: 42,
        capacity: 30,
        validFrom: '2026-08-25',
        validTo: '2027-08-25',
        idleWindowMinutes: 20,
        billingNote: 'Fenntartó Kft.',
      }),
    );

    component.startEdit();

    expect(component.editingId()).toBe(42);
    expect(component.editForm.getRawValue()).toEqual({
      capacity: 30,
      validFrom: '2026-08-25',
      validTo: '2027-08-25',
      idleWindowMinutes: 20,
      billingNote: 'Fenntartó Kft.',
    });
    expect(mocks.licenseStoreMock.clearError).toHaveBeenCalled();
  });

  // A lényeg: a szerkesztés VÉGSŐ soron a store már meglévő, tesztelt
  // update()-jét hívja meg - nem egy revoke+create workaroundot, ami
  // azonnal kirúgná a nem-vizsgázó diákokat és nullázná a kihasználtsági
  // előzményt egy vadonatúj licenc-id alatt.
  it('saveEdit() a szerkesztett mezőkkel meghívja a licenseStore.update()-öt, majd sikeres válasz után bezárja a formot', () => {
    configure();
    const { component } = create(makeLicense({ id: 42 }));

    component.startEdit();
    component.editForm.setValue({
      capacity: 40,
      validFrom: '2026-09-01',
      validTo: '2027-09-01',
      idleWindowMinutes: 25,
      billingNote: '  Új számlázási megjegyzés  ',
    });

    component.saveEdit();

    expect(mocks.licenseStoreMock.update).toHaveBeenCalledWith(
      42,
      {
        capacity: 40,
        validFrom: '2026-09-01',
        validTo: '2027-09-01',
        billingNote: 'Új számlázási megjegyzés',
        idleWindowMinutes: 25,
      },
      expect.any(Function),
    );
    // Az alap update()-mock szinkron hívja az onSuccess-t (mint a valódi
    // store `of()`-fal) - ez a sikeres válasz zárja a formot.
    expect(component.editingId()).toBeNull();
  });

  // Lost update (BE-INSTITUTIONALLICENSE-UPDATE-LOSTUPDATE): a betöltéskor kapott
  // konkurrencia-tokennek a mentéssel VISSZA kell utaznia. Enélkül a backend
  // `EnsureNotStale` a visszafelé kompatibilis (védelem nélküli) ágon menne át, és a
  // védelem némán hatástalan maradna - pontosan az a hiba, amit a lelet leír.
  it('saveEdit() visszaküldi a betöltött licenc konkurrencia-tokenjét', () => {
    configure();
    const { component } = create(makeLicense({ id: 42, rowVersion: 'AAAAAAAAB9k=' }));

    component.startEdit();
    component.editForm.patchValue({ capacity: 40, validFrom: '2026-09-01', validTo: '2027-09-01', idleWindowMinutes: 25 });

    component.saveEdit();

    const request = mocks.licenseStoreMock.update.mock.calls[0][1] as { rowVersion?: string };
    expect(request.rowVersion).toBe('AAAAAAAAB9k=');
  });

  // Adatvesztés elleni védelem: ütközésnél a form NEM zárhat be, különben az admin
  // begépelt módosítása elveszne, és a "töltsd újra" tanács értelmét vesztené.
  it('ütközésre (a store hiba-ága) a szerkesztő form nyitva marad a begépelt értékekkel', () => {
    configure();
    const { component } = create(makeLicense({ id: 42, rowVersion: 'elavult' }));
    // A valódi store hiba esetén NEM hívja az onSuccess-t.
    mocks.licenseStoreMock.update.mockImplementation(() => {});

    component.startEdit();
    component.editForm.controls.capacity.setValue(99);

    component.saveEdit();

    expect(component.editingId()).toBe(42);
    expect(component.editForm.controls.capacity.value).toBe(99);
  });

  it('saveEdit() üres számlázási megjegyzést null-ra alakít', () => {
    configure();
    const { component } = create(makeLicense({ id: 42 }));

    component.startEdit();
    component.editForm.controls.billingNote.setValue('   ');

    component.saveEdit();

    expect(mocks.licenseStoreMock.update).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ billingNote: null }),
      expect.any(Function),
    );
  });

  // UI-TT-199: a mentés korábban a HTTP-válasz előtt, FELTÉTEL NÉLKÜL zárta a formot. Ha a
  // backend elutasítja a kérést (pl. `ValidateRange`: felcserélt validFrom/validTo - könnyű
  // elgépelés két szomszédos dátum-mezőnél), a form már bezárult, mire a hiba megérkezett -
  // az admin begépelt módosítása véglegesen elveszett. A HELYES viselkedés: a store csak
  // SIKERES válasz esetén hívja az onSuccess-t (ld. `admin-license.store.spec.ts`), a
  // komponens pedig KIZÁRÓLAG onnan zár.
  it('BUG UI-TT-199 javítva: saveEdit() sikertelen backend-válasz esetén NEM zárja be a formot, a begépelt módosítás megmarad', () => {
    configure([makeLicense({ id: 42, capacity: 30, validFrom: '2026-08-25', validTo: '2027-08-25' })]);
    const { component } = create(makeLicense({ id: 42, capacity: 30, validFrom: '2026-08-25', validTo: '2027-08-25' }));
    // A store `error`-ágát szimuláljuk: hiba esetén a valódi store SOSEM hívja az onSuccess-t.
    mocks.licenseStoreMock.update.mockImplementation(() => {
      /* onSuccess szándékosan nincs meghívva - a backend elutasította a kérést */
    });

    // Az admin megnyitja a szerkesztőt, és elgépeli a két dátumot (felcseréli őket) - ez
    // élesben a backend `ValidateRange`-jét biztosan elbuktatja.
    component.startEdit();
    component.editForm.patchValue({ capacity: 50, validFrom: '2027-09-01', validTo: '2026-09-01' });
    component.saveEdit();

    // A backend elutasította -> a form NEM zárult be, és az admin begépelt értékei
    // megmaradtak, hogy csak a hibás mezőt kelljen javítania.
    expect(component.editingId()).toBe(42);
    expect(component.editForm.controls.capacity.value).toBe(50);
    expect(component.editForm.controls.validFrom.value).toBe('2027-09-01');
    expect(component.editForm.controls.validTo.value).toBe('2026-09-01');
  });

  // UI-TT-200: a kapacitás-csökkentéses update() válasza is hordozhatja a
  // `skippedDueToActiveSessionCount`-ot (BE-ADMINUPDATE-CAPACITYREDUCTION-SILENT-SKIP) - a
  // sikeres mentés utáni toast korrigálja, ha nem minden hely szabadult fel ténylegesen.
  it('saveEdit() sikeres válasz után toast-figyelmeztetést mutat, ha vizsgázó diák miatt hely maradt bent', () => {
    configure();
    const { component } = create(makeLicense({ id: 42 }));
    mocks.licenseStoreMock.update.mockImplementation(
      (id: number, _req: unknown, onSuccess?: (license: InstitutionalLicenseDto) => void) => {
        onSuccess?.(makeLicense({ id, capacity: 5, skippedDueToActiveSessionCount: 2 }));
      },
    );

    component.startEdit();
    component.saveEdit();

    expect(component.editingId()).toBeNull();
    expect(mocks.toastServiceMock.warning).toHaveBeenCalledWith(expect.stringContaining('2 hely'));
  });

  it('saveEdit() no-op, ha a licenseStore éppen loading', () => {
    configure();
    mocks.licenseStoreMock.loading.set(true);
    const { component } = create(makeLicense({ id: 42 }));

    component.saveEdit();

    expect(mocks.licenseStoreMock.update).not.toHaveBeenCalled();
  });

  it('cancelEdit() bezárja a szerkesztő formot a store hívása nélkül', () => {
    configure();
    const { component } = create(makeLicense({ id: 42 }));

    component.startEdit();
    expect(component.editingId()).toBe(42);

    component.cancelEdit();

    expect(component.editingId()).toBeNull();
    expect(mocks.licenseStoreMock.update).not.toHaveBeenCalled();
  });

  it('a "Szerkesztés" gombra kattintva megnyílik a szerkesztő form a kapacitás-mezővel', () => {
    configure();
    const { fixture, component } = create(makeLicense({ id: 10, schoolId: 1, capacity: 30 }));

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const editButton = buttons.find((b) => b.textContent?.trim() === 'Szerkesztés');
    editButton!.click();
    fixture.detectChanges();

    const capacityInput: HTMLInputElement = fixture.nativeElement.querySelector('input[name="edit-cap-10"]');
    expect(capacityInput).toBeTruthy();
    expect(component.editingId()).toBe(10);
    expect(component.editForm.controls.capacity.value).toBe(30);
  });

  // UI-TT-200: a `confirmRevoke()` dialógusa feltétel nélkül ígéri, hogy "a jelenleg
  // használt N hely azonnal felszabadul" - ez szándékosan nem igaz, ha egy diák épp
  // vizsgázik/kvízt ír (a backend `BE-LICENSEREVOKE-BULK-SILENT-FALSE-SUCCESS` fixe óta
  // ilyenkor SZÁNDÉKOSAN kihagyja a helyét). A HELYES viselkedés: a sikeres visszavonás
  // után egy toast korrigálja az ígéretet, ha a valóság eltér tőle.
  it('confirmRevoke() sikeres visszavonás után toast-figyelmeztetést mutat, ha vizsgázó diák miatt hely maradt bent', async () => {
    configure([makeLicense({ id: 42, schoolId: 1, heldSeats: 5 })]);
    mocks.licenseStoreMock.revoke.mockImplementation(
      (
        _id: number,
        onSuccess?: (result: { releasedCount: number; skippedDueToActiveSessionCount: number }) => void,
      ) => {
        onSuccess?.({ releasedCount: 3, skippedDueToActiveSessionCount: 2 });
      },
    );
    const { component } = create(makeLicense({ id: 42, schoolId: 1, heldSeats: 5 }));

    await component.confirmRevoke();

    expect(mocks.licenseStoreMock.revoke).toHaveBeenCalledWith(42, expect.any(Function));
    expect(mocks.toastServiceMock.warning).toHaveBeenCalledWith(expect.stringContaining('2 hely'));
  });

  it('confirmRevoke() NEM mutat toast-ot, ha minden hely felszabadult (skippedDueToActiveSessionCount = 0)', async () => {
    configure([makeLicense({ id: 42, schoolId: 1, heldSeats: 5 })]);
    const { component } = create(makeLicense({ id: 42, schoolId: 1, heldSeats: 5 }));

    // Az alap revoke()-mock skippedDueToActiveSessionCount: 0-val hívja az onSuccess-t.
    await component.confirmRevoke();

    expect(mocks.toastServiceMock.warning).not.toHaveBeenCalled();
  });
});

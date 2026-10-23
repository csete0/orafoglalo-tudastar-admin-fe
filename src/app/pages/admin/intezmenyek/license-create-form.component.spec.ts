import { TestBed } from '@angular/core/testing';
import { LicenseCreateFormComponent } from './license-create-form.component';
import { IntezmenyekMocks, createIntezmenyekMocks, makeLicense, makeSchool } from './intezmenyek.spec-data';

describe('LicenseCreateFormComponent', () => {
  let mocks: IntezmenyekMocks;

  function create(schoolId = 1) {
    mocks = createIntezmenyekMocks([makeSchool({ id: schoolId })], []);
    TestBed.configureTestingModule({ imports: [LicenseCreateFormComponent], providers: mocks.providers });
    const fixture = TestBed.createComponent(LicenseCreateFormComponent);
    fixture.componentRef.setInput('schoolId', schoolId);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  // BE-INSTLICENSEADMIN-CREATEFORM-LOCALMIDNIGHT-UTCDATE: az "+ Új licenc" a "mai naptól egy
  // tanévnyi időre" alapértelmezést tölti. Egy `toISOString().slice(0, 10)` a Date UTC-
  // komponenseiből olvasna, NEM a böngésző helyi (magyar) naptári napjából: Budapesten helyi
  // éjfél és UTC éjfél között minden nap van egy 1-2 órás ablak, amiben a UTC-nap még a
  // TEGNAPI magyar nap - ilyenkor a "ma"-ként látott dátum-mezők TEGNAPRA preselectálódnának.
  it('BUG BE-INSTLICENSEADMIN-CREATEFORM-LOCALMIDNIGHT-UTCDATE: helyi éjfél utáni, UTC éjfél előtti percben a "mai nap" alapértelmezés a TEGNAPI dátumot tölti be', () => {
    const originalTZ = process.env['TZ'];
    process.env['TZ'] = 'Europe/Budapest';

    // 2026-08-27 00:30 helyi idő (nyári, UTC+2) = 2026-08-26 22:30 UTC.
    // A helyi naptári nap már augusztus 27., de a UTC-nap még augusztus 26.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T22:30:00.000Z'));

    const { component } = create(1);

    component.start();

    expect(component.form.controls.validFrom.value).toBe('2026-08-27');

    vi.useRealTimers();
    process.env['TZ'] = originalTZ;
  });

  // UI-TT-208 (a UI-TT-199 testvér-hézaga): a "+ Új licenc" form korábban a store `create()`
  // hívása UTÁN, szinkron, feltétel nélkül zárt, jóval a HTTP-válasz előtt. Backend-
  // elutasításnál (pl. felcserélt validFrom/validTo) a form már bezárult, mire a hiba
  // megérkezett - az admin begépelt adatai véglegesen elvesztek. A form kizárólag a store
  // `onSuccess` callback-jéből zárhat.
  it('BUG UI-TT-208 javítva: createLicense() sikertelen backend-válasz esetén NEM zárja be a formot, a begépelt adatok megmaradnak', () => {
    const { component } = create(1);
    // A valódi store `create()`-je hiba esetén SOSEM hívja meg az `onSuccess` callback-et -
    // ezt szimuláljuk: a mock implementáció egyszerűen nem hívja meg a kapott callback-et.
    mocks.licenseStoreMock.create.mockImplementation(() => {
      /* a backend elutasította a kérést - onSuccess nem hívódik meg */
    });

    component.start();
    component.form.patchValue({
      tier: 'premium',
      capacity: 40,
      validFrom: '2027-09-01',
      validTo: '2026-09-01', // felcserélt dátum, élesben a backend elutasítaná
      billingNote: 'Fenntartó: Teszt Alapítvány',
    });
    component.create();

    // A form NYITVA marad, az admin begépelt adatai megmaradnak, amíg a backend nem
    // erősíti meg a sikert.
    expect(component.openSchoolId()).toBe(1);
    expect(component.form.controls.capacity.value).toBe(40);
    expect(component.form.controls.validFrom.value).toBe('2027-09-01');
    expect(component.form.controls.billingNote.value).toBe('Fenntartó: Teszt Alapítvány');
  });

  it('createLicense() sikeres válasz esetén bezárja a formot (onSuccess callback lefut)', () => {
    const { component } = create(1);
    mocks.licenseStoreMock.create.mockImplementation(
      (_request: unknown, onSuccess?: (license: unknown) => void) => onSuccess?.(makeLicense({ id: 50, schoolId: 1 })),
    );

    component.start();
    mocks.storeMock.load.mockClear();
    component.create();

    expect(component.openSchoolId()).toBeNull();
    // A „Nyilvános (licenc alapján)” jelölés a licenctől függ: az intézménylista újratöltődik.
    expect(mocks.storeMock.load).toHaveBeenCalledTimes(1);
  });
});

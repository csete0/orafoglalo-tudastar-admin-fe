import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AdminIntezmenyekComponent } from './admin-intezmenyek.component';
import { SchoolLicenseCardComponent } from './intezmenyek/school-license-card.component';
import {
  IntezmenyekMocks,
  createIntezmenyekMocks,
  makeLicense,
  makeSchool,
} from './intezmenyek/intezmenyek.spec-data';
import { SchoolAdminDto } from '../../models/teacher-moderation.model';
import { InstitutionalLicenseDto } from '../../models/institutional-license.model';

// A gyerek-komponensek saját spec-jei: intezmenyek/school-merge-panel, school-license-card, license-create-form,
// license-seat-list, license-usage-panel. Itt az oldal-szintű viselkedés (betöltés, hibairányítás, nyilvánosság).
describe('AdminIntezmenyekComponent', () => {
  let mocks: IntezmenyekMocks;

  function configure(schools?: SchoolAdminDto[], licenses?: InstitutionalLicenseDto[]) {
    mocks = createIntezmenyekMocks(schools, licenses);
    TestBed.configureTestingModule({ imports: [AdminIntezmenyekComponent], providers: mocks.providers });
  }

  /** A szerkesztő form megnyitása a licenc-kártya „Szerkesztés” gombjával. */
  function openEditor(el: HTMLElement, capacity: number) {
    const block = (Array.from(el.querySelectorAll('div.text-xs.mb-2')) as HTMLElement[]).find((b) =>
      b.textContent?.includes(`/${capacity} `),
    );
    const button = (Array.from(block!.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.trim() === 'Szerkesztés',
    );
    button!.click();
  }

  it('betöltéskor meghívja a store.load()-ot', () => {
    configure();
    TestBed.createComponent(AdminIntezmenyekComponent).detectChanges();
    expect(mocks.storeMock.load).toHaveBeenCalled();
  });

  it('a hely sorszáma 1-től számol, az időpontok budapesti helyi időben (a BE zóna nélkül küldi az UTC-t)', () => {
    configure([makeSchool({ id: 1, name: 'Forrás', createdAt: '2026-10-22T22:05:00' })], [makeLicense({ id: 40, schoolId: 1 })]);
    mocks.licenseStoreMock.seats.set({
      40: [{ userId: 1, displayName: 'Kovács Anna', email: 'anna@example.com', seatIndex: 0, claimedAt: '2026-10-22T22:00:00',
        lastActivityAt: '2026-10-22T22:20:00', isFresh: true, sessionInProgress: false }],
    });
    const fixture = TestBed.createComponent(AdminIntezmenyekComponent);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    buttons.find((b) => b.textContent?.includes('Helyek megtekintése'))!.click();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('1. hely');
    expect(text).not.toContain('#0');
    const day = new Date('2026-10-22T22:05:00Z');
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(text).toContain(`létrehozva ${day.getFullYear()}.${pad(day.getMonth() + 1)}.${pad(day.getDate())}`);
    const last = new Date('2026-10-22T22:20:00Z');
    expect(text).toContain(`utoljára: ${pad(last.getMonth() + 1)}.${pad(last.getDate())} ${pad(last.getHours())}:${pad(last.getMinutes())}`);
  });

  // UI-TT-201: a szerkesztő űrlap backend-elutasítás esetén helyesen NYITVA marad (UI-TT-199),
  // de a hibaüzenet (`licenseStore.error()`) korábban kizárólag a komponens LEGTETEJÉN
  // (az "Intézmények egyesítése" kártya FÖLÖTT) jelent meg, nem a szerkesztett licenc
  // kártyája mellett. Egy hosszabb intézmény-listán az admin, aki a lista alján lévő
  // licencet szerkeszti, a "Mentés" után NEM látott visszajelzést a látóterében.
  it('UI-TT-201 fix: a licenc-mentés hibaüzenete megjelenik a szerkesztett licenc kártyája mellett is', () => {
    const school1 = makeSchool({ id: 1, name: 'Forrás' });
    const school2 = makeSchool({ id: 2, name: 'Cél' });
    const license = makeLicense({ id: 20, schoolId: 2 });
    configure([school1, school2], [license]);
    const fixture = TestBed.createComponent(AdminIntezmenyekComponent);
    fixture.detectChanges();

    openEditor(fixture.nativeElement, license.capacity);
    // A valódi store `update()` hiba-ága a signal mellett `errorSource`/`errorLicenseId`-t
    // is beállítja ('edit', a szerkesztett licenc id-je) - ezt szimuláljuk itt is (UI-TT-206).
    mocks.licenseStoreMock.error.set('Az érvényesség vége nem lehet korábbi a kezdeténél.');
    mocks.licenseStoreMock.errorSource.set('edit');
    mocks.licenseStoreMock.errorLicenseId.set(license.id);
    fixture.detectChanges();

    const schoolCards: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('li.card');
    const editedSchoolCard = schoolCards[1];
    expect(editedSchoolCard.textContent).toContain('Az érvényesség vége nem lehet korábbi a kezdeténél.');
  });

  // UI-TT-206 (REGRESSION a UI-TT-201 fixre): a `licenseStore.error()` EGYETLEN,
  // megosztott signal MINDEN licenc-műveletre (create/update/revoke/releaseSeat -
  // admin-license.store.ts). A "Visszavonás"/"Felszabadítás" gombok NEM a szerkesztéshez
  // kötöttek - bármelyik licenc kártyáján elérhetők, függetlenül attól, hogy melyik licenc
  // szerkesztő formja van épp nyitva. Ha az admin megnyitja A licenc szerkesztő formját
  // (nem menti/zárja be), majd egy MÁSIK, B licencen "Visszavonás"-t/"Felszabadítás"-t
  // kattint, ami sikertelen, a hibának B licenc kártyáján kell megjelennie - nem A
  // érintetlen, nyitott formája alatt, és nem szabad eltűnnie sehonnan.
  it('UI-TT-206 javítva: egy MÁSIK licenc visszavonási hibája NEM tűnik el, és NEM egy harmadik licenc nyitott szerkesztő formája alatt jelenik meg', async () => {
    const school1 = makeSchool({ id: 1, name: 'Forrás' });
    // capacity-vel különböztetjük meg a két licenc-blokkot a DOM-ban (ownerName nem
    // jelenik meg a per-licenc blokkban, csak az intézmény neve, ami közös).
    const licenseA = makeLicense({ id: 30, schoolId: 1, capacity: 11 });
    const licenseB = makeLicense({ id: 31, schoolId: 1, capacity: 22 });
    configure([school1], [licenseA, licenseB]);

    mocks.licenseStoreMock.revoke = vi.fn((id: number) => {
      // Sikertelen visszavonás: a store az error-ágra fut, onSuccess NEM hívódik meg -
      // pontosan úgy, ahogy a valódi `AdminLicenseStore.revoke()` HTTP-hiba esetén
      // viselkedik: `error`/`errorSource: 'revoke'`/`errorLicenseId: id` együtt frissül.
      mocks.licenseStoreMock.error.set('A licenc visszavonása sikertelen.');
      mocks.licenseStoreMock.errorSource.set('revoke');
      mocks.licenseStoreMock.errorLicenseId.set(id);
    });

    const fixture = TestBed.createComponent(AdminIntezmenyekComponent);
    fixture.detectChanges();

    // Az admin nyitva hagyja A licenc szerkesztő formját...
    openEditor(fixture.nativeElement, licenseA.capacity);
    fixture.detectChanges();

    // ...majd megpróbálja visszavonni B licencet, ami sikertelen.
    const cardB = fixture.debugElement
      .queryAll(By.directive(SchoolLicenseCardComponent))
      .map((d) => d.componentInstance as SchoolLicenseCardComponent)
      .find((c) => c.license().id === licenseB.id);
    await cardB!.confirmRevoke();
    fixture.detectChanges();

    const licenseBlocks = Array.from(fixture.nativeElement.querySelectorAll('div.text-xs.mb-2')) as HTMLElement[];
    const blockB = licenseBlocks.find((el) => el.textContent?.includes('/22 '));
    const blockA = licenseBlocks.find((el) => el.textContent?.includes('/11 '));

    // A hiba B licenc visszavonásából származik - B blokkjában kell megjelennie.
    expect(blockB?.textContent).toContain('A licenc visszavonása sikertelen.');
    // ...és semmiképp sem A (érintetlen, nyitott formájú) licenc alatt.
    expect(blockA?.textContent).not.toContain('A licenc visszavonása sikertelen.');

    // A globális sáv (a komponens tetején) se duplikálja - a hiba B kártyáján már
    // megjelenik, a szerkesztés alatt lévő A form pedig érintetlen maradt.
    const globalBanner = fixture.nativeElement.querySelector('p.text-danger.text-sm.mb-4');
    expect(globalBanner).toBeFalsy();
  });

  // Ugyanaz a hibaosztály, mint UI-TT-206, de a "Felszabadítás" gombbal (releaseSeat) -
  // a hunter write-up ezt is kifejezetten megemlíti ("Visszavonás" VAGY "Felszabadítás"),
  // ezért itt is le kell fednünk, nem csak a revoke-ot.
  it('UI-TT-206 javítva (releaseSeat variáns): egy MÁSIK licenc hely-felszabadítási hibája a saját kártyáján jelenik meg, nem egy nyitott szerkesztő form alatt', () => {
    const school1 = makeSchool({ id: 1, name: 'Forrás' });
    const licenseA = makeLicense({ id: 30, schoolId: 1, capacity: 11 });
    const licenseB = makeLicense({ id: 31, schoolId: 1, capacity: 22 });
    configure([school1], [licenseA, licenseB]);

    mocks.licenseStoreMock.releaseSeat = vi.fn((licenseId: number) => {
      mocks.licenseStoreMock.error.set('A hely felszabadítása sikertelen.');
      mocks.licenseStoreMock.errorSource.set('releaseSeat');
      mocks.licenseStoreMock.errorLicenseId.set(licenseId);
    });

    const fixture = TestBed.createComponent(AdminIntezmenyekComponent);
    fixture.detectChanges();

    // Az admin nyitva hagyja A licenc szerkesztő formját...
    openEditor(fixture.nativeElement, licenseA.capacity);
    fixture.detectChanges();

    // ...majd B licencen egy hely felszabadítását próbálja, ami sikertelen.
    fixture.componentInstance.licenseStore.releaseSeat(licenseB.id, 99);
    fixture.detectChanges();

    const licenseBlocks = Array.from(fixture.nativeElement.querySelectorAll('div.text-xs.mb-2')) as HTMLElement[];
    const blockB = licenseBlocks.find((el) => el.textContent?.includes('/22 '));
    const blockA = licenseBlocks.find((el) => el.textContent?.includes('/11 '));

    expect(blockB?.textContent).toContain('A hely felszabadítása sikertelen.');
    expect(blockA?.textContent).not.toContain('A hely felszabadítása sikertelen.');
  });

  // Próbaérettségi iskolakereső: licenc nélküli intézmény csak admin-jóváhagyással nyilvános.
  describe('próbaérettségi-nyilvánosság', () => {
    const pending = makeSchool({ id: 1, name: 'Várakozó Suli' });
    const approved = makeSchool({ id: 2, name: 'Jóváhagyott Suli', publicApprovedAt: '2026-10-10T10:00:00Z' });
    const licensed = makeSchool({ id: 3, name: 'Licencelt Suli', hasLicense: true });

    it('licenc nélküli intézménynél kapcsoló, licencelt intézménynél csak címke jelenik meg', () => {
      configure([pending, licensed]);
      const fixture = TestBed.createComponent(AdminIntezmenyekComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelector('[data-testid="public-approval-1"] input[type="checkbox"]')).not.toBeNull();
      expect(el.querySelector('[data-testid="public-approval-1"]')?.textContent).toContain('jóváhagyásra vár');
      expect(el.querySelector('[data-testid="public-approval-3"] input[type="checkbox"]')).toBeNull();
      expect(el.querySelector('[data-testid="public-approval-3"]')?.textContent).toContain('licenc alapján');
    });

    it('jóváhagyás megerősítés után hívja a store-t', async () => {
      configure([pending]);
      const component = TestBed.createComponent(AdminIntezmenyekComponent).componentInstance;

      await component.confirmPublicToggle(pending);

      expect(mocks.confirmServiceMock.ask).toHaveBeenCalledWith(expect.objectContaining({ confirmLabel: 'Jóváhagyás', danger: false }));
      expect(mocks.storeMock.setPublicApproval).toHaveBeenCalledWith(1, true);
    });

    it('visszavonás veszélyes műveletként kér megerősítést; elutasításnál nem hív semmit', async () => {
      configure([approved]);
      mocks.confirmServiceMock.ask.mockResolvedValue(false);
      const component = TestBed.createComponent(AdminIntezmenyekComponent).componentInstance;

      await component.confirmPublicToggle(approved);

      expect(mocks.confirmServiceMock.ask).toHaveBeenCalledWith(expect.objectContaining({ confirmLabel: 'Visszavonás', danger: true }));
      expect(mocks.storeMock.setPublicApproval).not.toHaveBeenCalled();
    });

    it('a "csak jóváhagyásra várók" szűrő a licenc nélküli, jóvá nem hagyott intézményeket mutatja', () => {
      configure([pending, approved, licensed]);
      const component = TestBed.createComponent(AdminIntezmenyekComponent).componentInstance;

      expect(component.pendingPublicCount()).toBe(1);
      component.onlyPendingPublic.set(true);
      expect(component.visibleSchools().map((s) => s.id)).toEqual([1]);
    });
  });

  it('nincs iskolatípus-felülírás az intézménylistán', () => {
    configure();
    const fixture = TestBed.createComponent(AdminIntezmenyekComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid^="school-type-"]')).toBeNull();
    expect(el.textContent).not.toContain('Iskolatípus');
  });
});

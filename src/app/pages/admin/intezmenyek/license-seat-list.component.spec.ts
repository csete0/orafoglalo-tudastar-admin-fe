import { TestBed } from '@angular/core/testing';
import { LicenseSeatListComponent } from './license-seat-list.component';
import { createIntezmenyekMocks, makeLicense, makeSchool } from './intezmenyek.spec-data';

describe('LicenseSeatListComponent', () => {
  // UI-TT-210 testvér-hiba (teacher-fe csoport-reszletek.component.ts): a per-diák
  // jelvény ott KIZÁRÓLAG "vizsga folyamatban"-t írt `hasSessionInProgress=true` esetén,
  // holott a mögöttes flag vizsga VAGY kvíz miatt is igaz lehet. Ugyanez a hiba itt, a
  // platform-admin "Helyek megtekintése" listáján is megvolt: a backend
  // (InstitutionalLicenseAdminService.GetSeatHoldersAsync) explicit kommentben mondja
  // "Ugyanaz a predikátum, mint a tanári áttekintésben" (ExamSessions VAGY QuizSessions),
  // és a DTO mezőjének saját kommentje is "Éppen vizsgát/kvízt ír" - de a felület
  // "vizsgázik" (kizárólag vizsgára utaló) szöveget renderelt egy kvíz-only diáknál is.
  it('UI-TT-210 testvér javítva: a "vizsgázik/kvízt ír" jelvény kvíz-only munkamenetnél is típus-semleges szöveget ír', () => {
    const mocks = createIntezmenyekMocks([makeSchool({ id: 1, name: 'Forrás' })], [makeLicense({ id: 40, schoolId: 1, capacity: 5 })]);
    mocks.licenseStoreMock.seats.set({
      40: [
        {
          userId: 1,
          displayName: 'Kovács Anna',
          email: 'anna@example.com',
          seatIndex: 0,
          claimedAt: '2026-08-28T08:00:00Z',
          lastActivityAt: '2026-08-28T08:05:00Z',
          isFresh: true,
          // A diák valójában csak egy TANÁRI KVÍZT tölt ki, nincs vizsgája - de a
          // backend flag (ExamSessions VAGY QuizSessions) emiatt is igaz.
          sessionInProgress: true,
        },
      ],
    });
    TestBed.configureTestingModule({ imports: [LicenseSeatListComponent], providers: mocks.providers });

    const fixture = TestBed.createComponent(LicenseSeatListComponent);
    fixture.componentRef.setInput('licenseId', 40);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.text-warning');
    expect(badge?.textContent).toContain('kvíz');
  });
});

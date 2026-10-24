import { TestBed } from '@angular/core/testing';
import { LicenseUsagePanelComponent } from './license-usage-panel.component';
import { InstitutionalLicenseUsageDto } from '../../../models/institutional-license.model';

describe('LicenseUsagePanelComponent', () => {
  function render(usage: InstitutionalLicenseUsageDto): string {
    const fixture = TestBed.createComponent(LicenseUsagePanelComponent);
    fixture.componentRef.setInput('usage', usage);
    fixture.detectChanges();
    return fixture.nativeElement.textContent as string;
  }

  // BE-LICENSEUSAGE-ATCAPACITY-DISPLAY-CURRENTCAP: a napi "csúcs X/Y" sor korábban a
  // top-szintű (MOSTANI) usage.capacity-vel párosította a napi peakSeatsInUse-t - ha egy
  // admin időközben lecsökkentette a licenc kapacitását, ez a tegnapi (történelmileg
  // helyesen 100%-on futó) napra "csúcs 2/0"-t mutatott, ellentmondva a mellette helyesen
  // számolt AtCapacity-nek. A napi sornak a saját, aznapi (CapacityThatDay) kerethez kell
  // viszonyítania.
  it('UI-TT-214 testvér javítva: a napi kihasználtsági sor a TÖRTÉNELMI (aznapi) kerethez viszonyít, nem a licenc mostani kapacitásához', () => {
    const text = render({
      licenseId: 40,
      capacity: 0,
      rangeDays: 7,
      totalDenied: 0,
      totalReclaimed: 0,
      peakSeatsInUse: 2,
      daysAtCapacity: 1,
      daily: [
        {
          day: '2026-08-27T00:00:00Z',
          peakSeatsInUse: 2,
          denied: 0,
          reclaimed: 0,
          atCapacity: true,
          capacityThatDay: 2,
        },
      ],
    });

    expect(text).toContain('csúcs 2/2');
    expect(text).not.toContain('csúcs 2/0');
  });

  // UI-TT-220: az összegző "Csúcs: X/Y hely" sor a fenti (UI-TT-214 testvér) javítás UTÁN
  // is a MOSTANI usage.capacity-vel párosította a teljes időszak peakSeatsInUse-át - ugyanaz
  // az önellentmondás, csak az összegző sorban, nem a napi listában. A csúcsot ahhoz a
  // kerethez kell viszonyítani, ami AZON A NAPON érvényes volt, amikor a csúcs történt.
  it('BUG UI-TT-220 javítva: az összegző "Csúcs" sor a csúcs NAPJÁN érvényes kerethez viszonyít, nem a licenc mostani (lecsökkentett) kapacitásához', () => {
    const text = render({
      licenseId: 41,
      capacity: 0,
      rangeDays: 7,
      totalDenied: 0,
      totalReclaimed: 0,
      peakSeatsInUse: 2,
      daysAtCapacity: 1,
      daily: [
        {
          day: '2026-08-26T00:00:00Z',
          peakSeatsInUse: 0,
          denied: 0,
          reclaimed: 0,
          atCapacity: false,
          capacityThatDay: 0,
        },
        {
          day: '2026-08-27T00:00:00Z',
          peakSeatsInUse: 2,
          denied: 0,
          reclaimed: 0,
          atCapacity: true,
          capacityThatDay: 2,
        },
      ],
    });

    expect(text).toContain('Csúcs: 2/2 hely');
    expect(text).not.toContain('Csúcs: 2/0 hely');
  });

  // UI-TT-220 reziduális testvér (UI-TT-221): a csúcs-keret egy `usage.daily.find(...)`-dal az
  // ELSŐ (időrendben legkorábbi) napot választotta, ami eléri az összesített csúcsot - ha a
  // kapacitás-csökkentés ELŐTTI és UTÁNI napok EGYFORMA peakSeatsInUse-t produkálnak, a find()
  // a régi, immár érvénytelen, TÁGABB kerethez viszonyít - miközben a licenc az UTÓBBI napon
  // ténylegesen 100%-on állt. Az eredmény nem önellentmondó (2 <= 5), de FÉLREVEZETŐ.
  it('BUG UI-TT-221 javítva: azonos csúcs-értékű napok között a LEGSZŰKEBB (tie-elt) kerethez viszonyít, nem a régi, tágabb kerethez', () => {
    const text = render({
      licenseId: 42,
      capacity: 2,
      rangeDays: 7,
      totalDenied: 0,
      totalReclaimed: 0,
      peakSeatsInUse: 2,
      daysAtCapacity: 1,
      daily: [
        {
          // Régebbi nap: akkor még 5-ös volt a keret, 2 fő volt bent - bőven ráért.
          day: '2026-08-20T00:00:00Z',
          peakSeatsInUse: 2,
          denied: 0,
          reclaimed: 0,
          atCapacity: false,
          capacityThatDay: 5,
        },
        {
          // Admin időközben 2-re csökkentette a keretet - ezen a napon a 2 fő már 100%.
          day: '2026-08-27T00:00:00Z',
          peakSeatsInUse: 2,
          denied: 0,
          reclaimed: 0,
          atCapacity: true,
          capacityThatDay: 2,
        },
      ],
    });

    // A helyes viselkedés: mivel VOLT olyan nap, ami ténylegesen betelt (daysAtCapacity: 1),
    // az összegzőnek ezt kell tükröznie, nem a régi, már érvénytelen, tágabb keretet.
    expect(text).toContain('Csúcs: 2/2 hely');
    expect(text).not.toContain('Csúcs: 2/5 hely');
  });
});

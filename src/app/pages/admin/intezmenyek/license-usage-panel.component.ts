import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { InstitutionalLicenseUsageDto } from '../../../models/institutional-license.model';

/** Egy licenc kihasználtsági kimutatása: `<div app-license-usage-panel class="mt-2 …" [usage]="…">`. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'div[app-license-usage-panel]',
  imports: [DatePipe],
  template: `
    <p class="font-semibold mb-1">Kihasználtság — elmúlt {{ usage().rangeDays }} nap</p>

    <!-- A bővítési döntés fő száma előre: hányan nem fértek be,
         pedig jogosultak lettek volna. -->
    <p [class]="usage().totalDenied > 0 ? 'text-danger font-bold' : 'text-text-muted'">
      {{ usage().totalDenied }} alkalommal nem jutott hely olyan diáknak, aki jogosult lett volna
    </p>
    <p class="text-text-muted">
      Csúcs: {{ usage().peakSeatsInUse }}/{{ peakCapacity() }} hely ·
      {{ usage().daysAtCapacity }} napon telt be ·
      {{ usage().totalReclaimed }} átvétel tétlen diáktól
    </p>

    @if (usage().totalDenied > 0) {
      <p class="mt-1">
        Ez a keret szűk: érdemes megfontolni a bővítést.
      </p>
    }

    @if (activeDays().length > 0) {
      <ul class="mt-2 space-y-0.5">
        @for (day of activeDays(); track day.day) {
          <li>
            <span class="text-text-muted">{{ day.day | date: 'MM.dd' }}</span>
            <!-- BE-LICENSEUSAGE-ATCAPACITY-DISPLAY-CURRENTCAP: az AZNAP
                 érvényes kerethez (capacityThatDay) viszonyítunk, nem a
                 mostanihoz (usage.capacity) - egy utólagos kapacitás-
                 módosítás után a kettő eltérhet, és a mostanihoz mérve
                 önellentmondó számpárt mutatott (pl. "csúcs 2/0"). -->
            · csúcs {{ day.peakSeatsInUse }}/{{ day.capacityThatDay }}
            @if (day.denied > 0) {
              · <span class="text-danger">{{ day.denied }} sikertelen belépési kísérlet</span>
            }
            @if (day.reclaimed > 0) {
              · {{ day.reclaimed }} átvétel
            }
          </li>
        }
      </ul>
    } @else {
      <p class="text-text-muted mt-1">Ebben az időszakban nem volt használat.</p>
    }
  `,
})
export class LicenseUsagePanelComponent {
  readonly usage = input.required<InstitutionalLicenseUsageDto>();

  /**
   * Csak azokat a napokat listázzuk, ahol TÖRTÉNT valami - egy 30 elemű, csupa
   * nulla lista elrejtené a lényeget. Az összesítők (fent) így is a teljes
   * időszakra vonatkoznak.
   */
  readonly activeDays = computed(() =>
    this.usage().daily.filter((d) => d.peakSeatsInUse > 0 || d.denied > 0 || d.reclaimed > 0),
  );

  /**
   * UI-TT-220: az összegző sor korábban a teljes időszak `peakSeatsInUse`-át a MOSTANI
   * (`usage.capacity`) kerethez viszonyította - egy utólagos kapacitás-csökkentés után ez
   * ugyanazt az önellentmondó "csúcs 2/0" számpárt mutatta, mint amit a
   * BE-LICENSEUSAGE-ATCAPACITY-DISPLAY-CURRENTCAP már javított a napi soroknál. A csúcsot
   * ahhoz a kerethez viszonyítjuk, ami AZON A NAPON ténylegesen érvényes volt, amikor a
   * csúcs történt - ez sosem lehet önellentmondó, mert egy adott napon a peakSeatsInUse
   * sosem haladhatja meg az aznap érvényes kapacitást.
   *
   * UI-TT-221: ha TÖBB nap is eléri az összesített csúcsot (pl. egy kapacitás-csökkentés
   * előtti tágabb kereten belüli nap ÉS egy utána következő, a szűkebb keretet éppen
   * betöltő nap), az első találat a régi, tágabb kerethez viszonyítana, elrejtve a valódi
   * (későbbi) telítettséget. A tie-elt napok közül mindig a LEGKISEBB capacityThatDay-t
   * választjuk - ez sosem lehet félrevezetőbb bármelyik másik tie-elt napnál.
   */
  readonly peakCapacity = computed(() => {
    const usage = this.usage();
    const tiedDays = usage.daily.filter((d) => d.peakSeatsInUse === usage.peakSeatsInUse);
    if (tiedDays.length === 0) return usage.capacity;
    return Math.min(...tiedDays.map((d) => d.capacityThatDay));
  });
}

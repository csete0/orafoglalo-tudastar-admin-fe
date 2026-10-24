import { TestBed } from '@angular/core/testing';
import { SchoolMergePanelComponent } from './school-merge-panel.component';
import { IntezmenyekMocks, createIntezmenyekMocks, makeSchool } from './intezmenyek.spec-data';
import { SchoolAdminDto } from '../../../models/teacher-moderation.model';

describe('SchoolMergePanelComponent', () => {
  let mocks: IntezmenyekMocks;

  function configure(schools?: SchoolAdminDto[]) {
    mocks = createIntezmenyekMocks(schools);
    TestBed.configureTestingModule({ imports: [SchoolMergePanelComponent], providers: mocks.providers });
  }

  function create() {
    const fixture = TestBed.createComponent(SchoolMergePanelComponent);
    return { fixture, component: fixture.componentInstance };
  }

  const select = (component: SchoolMergePanelComponent, sourceId: number | null, targetId: number | null) =>
    component.form.setValue({ sourceId, targetId });

  // canMerge(): mindkét intézményt ki kell választani, ÉS a forrás nem lehet
  // ugyanaz, mint a cél - ez az EGYETLEN kliens-oldali védelem, ami elé áll
  // ennek a visszavonhatatlan (forrás-törléssel járó) admin-műveletnek.
  it('canMerge() hamis, ha nincs kiválasztva forrás vagy cél', () => {
    configure();
    const { fixture, component } = create();
    fixture.detectChanges();

    expect(component.canMerge()).toBe(false);

    select(component, 1, null);
    expect(component.canMerge()).toBe(false);

    select(component, 1, 2);
    expect(component.canMerge()).toBe(true);
  });

  it('canMerge() hamis, ha a forrás és a cél ugyanaz az intézmény', () => {
    configure();
    const { fixture, component } = create();
    fixture.detectChanges();

    select(component, 1, 1);

    expect(component.canMerge()).toBe(false);
  });

  it('az "Egyesítés" gomb kezdetben letiltva, amíg nincs érvényesen kiválasztva forrás és cél', () => {
    configure();
    const { fixture } = create();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBe(true);
  });

  it('érvényes forrás+cél kiválasztás esetén az "Egyesítés" gomb engedélyezett', () => {
    configure();
    const { fixture, component } = create();
    select(component, 1, 2);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBe(false);
  });

  it('store.loading() alatt az "Egyesítés" gomb letiltott, még érvényes kiválasztás mellett is', () => {
    configure();
    mocks.storeMock.loading.set(true);
    const { fixture, component } = create();
    select(component, 1, 2);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBe(true);
  });

  // Ez a visszavonhatatlan admin-akció (forrás intézmény törlődik, tanárai/
  // csoportjai átkerülnek) - a megerősítő dialógusnak `danger: true`-t KELL
  // kapnia, és a konkrét intézményneveket KELL tartalmaznia, hogy az admin
  // pontosan lássa, mit egyesít mivel, mielőtt jóváhagyná.
  it('confirmMerge() a konkrét forrás/cél intézménynévvel és danger=true-val kéri a megerősítést', async () => {
    configure([makeSchool({ id: 1, name: 'Duplikált Gimnázium' }), makeSchool({ id: 2, name: 'Fő Gimnázium' })]);
    const { fixture, component } = create();
    fixture.detectChanges();

    select(component, 1, 2);
    await component.confirmMerge();

    expect(mocks.confirmServiceMock.ask).toHaveBeenCalledWith(
      expect.objectContaining({
        danger: true,
        message: expect.stringContaining('Duplikált Gimnázium'),
      }),
    );
    expect(mocks.confirmServiceMock.ask.mock.calls[0][0].message).toContain('Fő Gimnázium');
    expect(mocks.storeMock.merge).toHaveBeenCalledWith(1, 2);
  });

  it('a dialógus elutasítása esetén confirmMerge() NEM hívja meg a store.merge()-öt, és a kiválasztás megmarad', async () => {
    configure();
    mocks.confirmServiceMock.ask.mockResolvedValue(false);
    const { fixture, component } = create();
    fixture.detectChanges();

    select(component, 1, 2);
    await component.confirmMerge();

    expect(mocks.storeMock.merge).not.toHaveBeenCalled();
    expect(component.form.controls.sourceId.value).toBe(1);
    expect(component.form.controls.targetId.value).toBe(2);
  });

  it('sikeres jóváhagyás után confirmMerge() törli a sourceId/targetId kiválasztást', async () => {
    configure();
    const { fixture, component } = create();
    fixture.detectChanges();

    select(component, 1, 2);
    await component.confirmMerge();

    expect(mocks.storeMock.merge).toHaveBeenCalledWith(1, 2);
    expect(component.form.controls.sourceId.value).toBeNull();
    expect(component.form.controls.targetId.value).toBeNull();
  });

  // confirmMerge() a `canMerge()`-öt (és a store.loading()-ot) ÚJRA ellenőrzi
  // a metódus elején - egy dupla-kattintás (mielőtt a gomb [disabled]
  // bindingja ténylegesen letiltaná a DOM-elemet) nem indíthat két egyidejű
  // egyesítést.
  it('confirmMerge() store.loading() alatt no-op, még akkor is, ha canMerge() igaz', async () => {
    configure();
    mocks.storeMock.loading.set(true);
    const { fixture, component } = create();
    fixture.detectChanges();

    select(component, 1, 2);
    await component.confirmMerge();

    expect(mocks.confirmServiceMock.ask).not.toHaveBeenCalled();
    expect(mocks.storeMock.merge).not.toHaveBeenCalled();
  });

  // UI-TT-195: a merge-eszköz kifejezetten VÉLETLENÜL DUPLIKÁLTAN létrejött,
  // tehát tipikusan AZONOS NEVŰ intézmények összevonására való. Két ilyen, azonos
  // nevű, de különböző város/id-jű intézmény esetén sem a forrás/cél legördülő
  // listák, sem a végső, "Ez nem vonható vissza." jóváhagyó dialógus szövege nem
  // különböztette meg őket - mindkét <option> és a dialógus üzenete is szó szerint
  // ugyanaz a szöveg volt, city/id nélkül.
  it('BUG UI-TT-195: két AZONOS NEVŰ intézmény a forrás/cél legördülőben és a jóváhagyó dialógusban is megkülönböztethetetlen', async () => {
    configure([
      makeSchool({ id: 1, name: 'Duplikált Gimnázium', city: 'Budapest' }),
      makeSchool({ id: 2, name: 'Duplikált Gimnázium', city: 'Szeged' }),
    ]);
    const { fixture, component } = create();
    fixture.detectChanges();

    const sourceSelect: HTMLSelectElement = fixture.nativeElement.querySelector('select[name="sourceId"]');
    const optionTexts = Array.from(sourceSelect.options)
      .slice(1) // az első a "Válassz…" placeholder
      .map((o) => o.textContent?.trim());

    // Elvárás: a két KÜLÖNBÖZŐ intézményhez tartozó opciószöveg legyen
    // megkülönböztethető (pl. tartalmazza a várost is).
    expect(new Set(optionTexts).size).toBe(2);

    select(component, 1, 2);
    await component.confirmMerge();

    // Elvárás: a visszavonhatatlan művelet jóváhagyó szövege azonosítsa,
    // MELYIK "Duplikált Gimnázium"-ot törli (pl. várossal).
    const message: string = mocks.confirmServiceMock.ask.mock.calls[0][0].message;
    expect(message).toContain('Budapest');
  });

  it('confirmMerge() no-op, ha a forrás vagy a cél már nem szerepel a store.schools() listájában', async () => {
    configure([makeSchool({ id: 1 })]);
    const { fixture, component } = create();
    fixture.detectChanges();

    // A cél (id=2) időközben eltűnt a listából (pl. egy párhuzamos törlés/egyesítés miatt).
    select(component, 1, 2);
    await component.confirmMerge();

    expect(mocks.confirmServiceMock.ask).not.toHaveBeenCalled();
    expect(mocks.storeMock.merge).not.toHaveBeenCalled();
  });
});

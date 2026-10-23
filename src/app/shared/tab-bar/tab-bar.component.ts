import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface TabItem<T extends string = string> {
  readonly id: T;
  readonly label: string;
}

/**
 * Fülsor-gombok a közös `.tab-btn` / `.tab-btn-active` stílussal. Attribútum-szelektor, így a konténer `<nav>` (és az osztályai,
 * `role="tablist"`, `data-testid`) a hívó sablonjában marad, a DOM nem kap új burkoló elemet:
 * `<nav app-tab-bar class="flex gap-5 …" role="tablist" [tabs]="tabs" [(active)]="tab"></nav>`.
 * Ha fülváltáskor mellékhatás kell (pl. lusta betöltés): `[active]="tab()" (activeChange)="selectTab($event)"`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'nav[app-tab-bar]',
  template: `
    @for (tab of tabs(); track tab.id) {
      <button type="button" role="tab" [attr.aria-selected]="active() === tab.id" class="tab-btn whitespace-nowrap"
        [class.tab-btn-active]="active() === tab.id" (click)="active.set(tab.id)">{{ tab.label }}</button>
    }
  `,
})
export class TabBarComponent<T extends string = string> {
  readonly tabs = input.required<readonly TabItem<T>[]>();
  readonly active = model.required<T>();
}

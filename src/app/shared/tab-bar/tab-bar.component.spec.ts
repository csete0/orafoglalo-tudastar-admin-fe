import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TabBarComponent, TabItem } from './tab-bar.component';

type Tab = 'a' | 'b' | 'c';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TabBarComponent],
  template: `
    <nav app-tab-bar class="flex gap-5" role="tablist" data-testid="tabs" [tabs]="tabs" [(active)]="tab"></nav>
    <p data-testid="current">{{ tab() }}</p>
  `,
})
class HostComponent {
  readonly tabs: readonly TabItem<Tab>[] = [
    { id: 'a', label: 'Első' },
    { id: 'b', label: 'Második' },
    { id: 'c', label: 'Harmadik' },
  ];
  readonly tab = signal<Tab>('b');
}

describe('TabBarComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    return { fixture, el, buttons: () => Array.from(el.querySelectorAll<HTMLButtonElement>('nav button')) };
  }

  it('a hívó <nav>-ja marad a konténer, a gombok a régi markupot kapják', () => {
    const { el, buttons } = render();
    const nav = el.querySelector('nav')!;
    expect(nav.getAttribute('role')).toBe('tablist');
    expect(nav.getAttribute('data-testid')).toBe('tabs');
    expect(nav.className).toBe('flex gap-5');
    expect(buttons().map((b) => b.textContent)).toEqual(['Első', 'Második', 'Harmadik']);
    for (const b of buttons()) {
      expect(b.getAttribute('type')).toBe('button');
      expect(b.getAttribute('role')).toBe('tab');
      expect(b.classList).toContain('tab-btn');
      expect(b.classList).toContain('whitespace-nowrap');
    }
  });

  it('csak az aktív fül kapja a tab-btn-active osztályt és az aria-selected="true"-t', () => {
    const { buttons } = render();
    expect(buttons().map((b) => b.classList.contains('tab-btn-active'))).toEqual([false, true, false]);
    expect(buttons().map((b) => b.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
  });

  it('kattintásra a kétirányú kötésen át vált', () => {
    const { fixture, el, buttons } = render();
    buttons()[2].click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="current"]')!.textContent).toBe('c');
    expect(buttons().map((b) => b.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
  });
});

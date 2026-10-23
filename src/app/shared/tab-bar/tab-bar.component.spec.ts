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

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TabBarComponent],
  template: `<div app-tab-bar variant="underline" class="flex gap-1" [tabs]="tabs" [(active)]="tab"></div>`,
})
class UnderlineHostComponent {
  readonly tabs: readonly TabItem<Tab>[] = [
    { id: 'a', label: 'Első' },
    { id: 'b', label: 'Második' },
  ];
  readonly tab = signal<Tab>('a');
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

  it('underline változat <div> konténerben: alsó-szegélyes gombok, az aktív kiemelve, kattintásra vált', () => {
    const fixture = TestBed.createComponent(UnderlineHostComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('div')!.className).toBe('flex gap-1');
    const buttons = () => Array.from(el.querySelectorAll<HTMLButtonElement>('div button'));
    const base = ['-mb-px', 'border-b-2', 'font-semibold', 'px-4', 'py-2', 'transition-colors'];
    const active = [...base, 'border-primary', 'text-primary'].sort();
    const inactive = [...base, 'border-transparent', 'text-text-muted'].sort();
    expect(buttons().map((b) => [...b.classList].sort())).toEqual([active, inactive]);
    expect(buttons().map((b) => b.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    buttons()[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.tab()).toBe('b');
    expect(buttons().map((b) => [...b.classList].sort())).toEqual([inactive, active]);
  });
});

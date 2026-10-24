import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PagerComponent } from './pager.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PagerComponent],
  template: `
    <div class="pager" app-pager data-testid="pager" [page]="page()" [pageSize]="pageSize" [total]="total()" [variant]="variant()"
      (pageChange)="changes.push($event); page.set($event)"></div>
  `,
})
class HostComponent {
  readonly page = signal(1);
  readonly pageSize = 50;
  readonly total = signal(120);
  readonly variant = signal<'plain' | 'ghost'>('plain');
  readonly changes: number[] = [];
}

describe('PagerComponent', () => {
  function render(setup: (h: HostComponent) => void = () => undefined) {
    const fixture = TestBed.createComponent(HostComponent);
    setup(fixture.componentInstance);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const pager = el.querySelector<HTMLElement>('[data-testid="pager"]')!;
    const buttons = () => Array.from(pager.querySelectorAll('button'));
    return { fixture, host: fixture.componentInstance, pager, buttons };
  }

  it('plain: a régi lista-oldalak markupja a hívó konténerében („Előző · 1 / 3 · Következő”)', () => {
    const { pager, buttons } = render();
    expect(pager.className).toBe('pager');
    expect(Array.from(pager.children).map((c) => c.tagName)).toEqual(['BUTTON', 'SPAN', 'BUTTON']);
    expect(buttons().map((b) => b.textContent)).toEqual(['Előző', 'Következő']);
    expect(buttons().every((b) => b.getAttribute('type') === 'button' && b.className === '')).toBe(true);
    expect(pager.querySelector('span')!.textContent).toBe('1 / 3');
    expect(buttons().map((b) => b.disabled)).toEqual([true, false]);
  });

  it('a gombok a szomszédos oldalszámot adják ki; az utolsó oldalon a Következő tiltott', () => {
    const { fixture, host, pager, buttons } = render();
    buttons()[1].click();
    fixture.detectChanges();
    buttons()[1].click();
    fixture.detectChanges();
    expect(host.changes).toEqual([2, 3]);
    expect(pager.querySelector('span')!.textContent).toBe('3 / 3');
    expect(buttons().map((b) => b.disabled)).toEqual([false, true]);
    buttons()[0].click();
    expect(host.changes).toEqual([2, 3, 2]);
  });

  it('üres listánál is 1 / 1, mindkét gomb tiltott', () => {
    const { pager, buttons } = render((h) => h.total.set(0));
    expect(pager.querySelector('span')!.textContent).toBe('1 / 1');
    expect(buttons().map((b) => b.disabled)).toEqual([true, true]);
  });

  it('a pontosan teli utolsó oldal nem nyit új oldalt (100 / 50 → 2 oldal)', () => {
    const { pager } = render((h) => h.total.set(100));
    expect(pager.querySelector('span')!.textContent).toBe('1 / 2');
  });

  it('ghost: btn-ghost gombok nyilakkal, halvány oldalszám', () => {
    const { pager, buttons } = render((h) => { h.variant.set('ghost'); h.page.set(2); });
    expect(buttons().map((b) => b.textContent)).toEqual(['← Előző', 'Következő →']);
    expect(buttons().every((b) => b.className === 'btn btn-ghost !px-3 !py-1.5')).toBe(true);
    const span = pager.querySelector('span')!;
    expect(span.className).toBe('text-text-muted');
    expect(span.textContent).toBe('2 / 3');
    expect(buttons().map((b) => b.disabled)).toEqual([false, false]);
  });
});

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BarChartColumn, BarChartComponent } from './bar-chart.component';

const SVG_NS = 'http://www.w3.org/2000/svg';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarChartComponent],
  template: `
    <svg app-bar-chart data-testid="chart" class="w-full h-auto block mt-3" role="img" aria-label="Teszt" [columns]="columns()" [height]="height()"
      [clickable]="clickable()" (barClick)="clicks.push($event)"></svg>
  `,
})
class HostComponent {
  readonly columns = signal<BarChartColumn[]>([]);
  readonly height = signal(180);
  readonly clickable = signal(false);
  readonly clicks: string[] = [];
}

/**
 * ÁTMENETI összehasonlító referencia (WP-B2): a kódfuttató-oldal régi `ticks()`/`bars()` képlete (a fajtánkénti összegzés
 * helyett kész szeletekre), a régi paddingekkel. A fogyasztó oldalak (WP-C2/C5) átállása után törölhető.
 */
const LEGACY = { width: 860, padLeft: 36, padRight: 8, padTop: 10, padBottom: 22 };
function legacyTicks(columns: BarChartColumn[], height: number) {
  const plotH = height - LEGACY.padTop - LEGACY.padBottom;
  const max = Math.max(4, ...columns.map((c) => c.segments.reduce((s, r) => s + r.value, 0)));
  return [0, 1, 2, 3, 4].map((i) => ({ y: LEGACY.padTop + plotH - (i / 4) * plotH, label: String(Math.round((max / 4) * i)) }));
}
function legacyBars(columns: BarChartColumn[], height: number) {
  const plotW = LEGACY.width - LEGACY.padLeft - LEGACY.padRight;
  const plotH = height - LEGACY.padTop - LEGACY.padBottom;
  const step = plotW / Math.max(1, columns.length);
  const width = Math.max(2, Math.min(18, step * 0.7));
  const max = Math.max(4, ...columns.map((c) => c.segments.reduce((s, r) => s + r.value, 0)));
  return columns.map((c, i) => {
    let base = LEGACY.padTop + plotH;
    const segments = c.segments.flatMap((k) => {
      const runs = k.value;
      if (!runs) return [];
      const h = (runs / max) * plotH;
      base -= h;
      return [{ y: base, h, color: k.color }];
    });
    return { key: c.key, x: LEGACY.padLeft + i * step + (step - width) / 2, width, label: c.label ?? '', title: c.title ?? '', segments };
  });
}

const col = (key: string, values: number[], label?: string): BarChartColumn => ({
  key,
  label,
  title: `${key} súgó`,
  segments: values.map((value, i) => ({ value, color: `var(--c${i})` })),
});

describe('BarChartComponent', () => {
  function render(setup: (h: HostComponent) => void = () => undefined) {
    const fixture = TestBed.createComponent(HostComponent);
    setup(fixture.componentInstance);
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector<SVGSVGElement>('[data-testid="chart"]')!;
    const chart = fixture.debugElement.query(By.directive(BarChartComponent)).componentInstance as BarChartComponent;
    return { fixture, host: fixture.componentInstance, svg, chart };
  }

  const cases: [string, BarChartColumn[], number][] = [
    ['üres', [], 180],
    ['egy kicsi oszlop (a skála alja 4)', [col('a', [1])], 180],
    ['két nap, halmozott, 0-s szelettel', [col('2026-10-17', [40, 0, 0]), col('2026-10-18', [500, 0, 20, 0, 0])], 180],
    ['24 óra, sok üres', Array.from({ length: 24 }, (_, h) => col(String(h).padStart(2, '0'), h === 9 ? [300, 20] : h === 14 ? [200] : [0], h % 3 === 0 ? String(h) : '')), 180],
    ['60 oszlop (a szélesség se nem 2, se nem 18 px)', Array.from({ length: 60 }, (_, i) => col(`n${i}`, [(i * 37) % 11, i % 4])), 180],
    ['400 oszlop, keskeny oszlop (min. 2 px)', Array.from({ length: 400 }, (_, i) => col(`d${i}`, [i % 7, i % 3])), 180],
    ['projektműhely-magasság, két sorozat', [col('x', [3, 5]), col('y', [12, 0]), col('z', [0, 7])], 200],
  ];

  it.each(cases)('geometria bájtra azonos a régi számítással: %s', (_, columns, height) => {
    const { chart } = render((h) => {
      h.columns.set(columns);
      h.height.set(height);
    });
    expect(chart.ticks()).toEqual(legacyTicks(columns, height));
    expect(chart.bars()).toEqual(legacyBars(columns, height));
  });

  it('a hívó svg-je marad (osztály, role, aria-label), a viewBox a méretből jön, a gyerekek SVG-névtérben', () => {
    const { svg } = render((h) => h.columns.set([col('a', [2, 3], '00'), col('b', [1])]));
    expect(svg.getAttribute('class')).toBe('w-full h-auto block mt-3');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Teszt');
    expect(svg.getAttribute('viewBox')).toBe('0 0 860 180');
    expect(svg.querySelectorAll('line').length).toBe(5);
    // 3 szelet + 2 átlátszó súgó-téglalap
    expect(svg.querySelectorAll('rect').length).toBe(5);
    expect(Array.from(svg.querySelectorAll('*')).every((e) => e.namespaceURI === SVG_NS)).toBe(true);
    const tickLabels = Array.from(svg.querySelectorAll('text[text-anchor="end"]')).map((t) => t.textContent);
    expect(tickLabels).toEqual(['0', '1', '3', '4', '5']);
    // oszlopfelirat csak ahol van
    expect(Array.from(svg.querySelectorAll('text[text-anchor="middle"]')).map((t) => t.textContent)).toEqual(['00']);
    expect(Array.from(svg.querySelectorAll('title')).map((t) => t.textContent)).toEqual(['a súgó', 'b súgó']);
  });

  it('kattintható módban az oszlop kulcsát adja és mutató kurzort kap; alapból nem kattintható', () => {
    const { host, svg, fixture } = render((h) => h.columns.set([col('2026-10-18', [3])]));
    const overlay = () => svg.querySelector<SVGRectElement>('rect[fill="transparent"]')!;
    overlay().dispatchEvent(new MouseEvent('click'));
    expect(host.clicks).toEqual([]);
    expect(overlay().classList.contains('cursor-pointer')).toBe(false);

    host.clickable.set(true);
    fixture.detectChanges();
    overlay().dispatchEvent(new MouseEvent('click'));
    expect(host.clicks).toEqual(['2026-10-18']);
    expect(overlay().classList.contains('cursor-pointer')).toBe(true);
  });
});

import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';

/** Egy oszlop egy szelete (halmozott módban több, egyszerű oszlopnál egy). */
export interface BarChartSegment {
  value: number;
  color: string;
}

export interface BarChartColumn {
  key: string;
  /** Felirat az oszlop alatt; üres/hiányzó → nincs felirat. */
  label?: string;
  /** Buboréksúgó az egész oszlopra (`<title>`). */
  title?: string;
  segments: readonly BarChartSegment[];
}

export interface BarChartBar {
  key: string;
  x: number;
  width: number;
  label: string;
  title: string;
  segments: { y: number; h: number; color: string }[];
}

export interface BarChartTick {
  y: number;
  label: string;
}

const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

/**
 * SVG oszlopdiagram vízszintes rácsvonalakkal és y-tengely-feliratokkal; a szeletek alulról felfelé halmozódnak, a 0 értékűek
 * kimaradnak. Attribútum-szelektor (`<svg app-bar-chart class="…" role="img" aria-label="…">`), így a hívó adja az `svg`
 * osztályait és akadálymentes nevét, a DOM-ban nincs burkoló elem. A skála: max(`minMax`, legmagasabb oszlop).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'svg[app-bar-chart]',
  host: { '[attr.viewBox]': "'0 0 ' + width() + ' ' + height()" },
  template: `
    @for (tick of ticks(); track tick.y) {
      <svg:line [attr.x1]="padLeft" [attr.x2]="width() - padRight" [attr.y1]="tick.y" [attr.y2]="tick.y" stroke="var(--color-border-default)" stroke-width="1" />
      <svg:text [attr.x]="padLeft - 6" [attr.y]="tick.y + 3" text-anchor="end" font-size="10" fill="var(--color-text-muted)">{{ tick.label }}</svg:text>
    }
    @for (bar of bars(); track bar.key) {
      @for (s of bar.segments; track $index) {
        <svg:rect [attr.x]="bar.x" [attr.y]="s.y" [attr.width]="bar.width" [attr.height]="s.h" [attr.fill]="s.color" rx="2" />
      }
      @if (bar.label) {
        <svg:text [attr.x]="bar.x + bar.width / 2" [attr.y]="height() - 6" text-anchor="middle" font-size="10" fill="var(--color-text-muted)">{{ bar.label }}</svg:text>
      }
      <svg:rect [attr.x]="bar.x" [attr.y]="padTop" [attr.width]="bar.width" [attr.height]="height() - padTop - padBottom" fill="transparent"
        [class.cursor-pointer]="clickable()" (click)="clickable() && barClick.emit(bar.key)"><svg:title>{{ bar.title }}</svg:title></svg:rect>
    }
  `,
})
export class BarChartComponent {
  readonly columns = input.required<readonly BarChartColumn[]>();
  readonly width = input(860);
  readonly height = input(180);
  /** A skála alsó korlátja (kis értékeknél se legyen egyetlen oszlop teljes magasságú). */
  readonly minMax = input(4);
  readonly tickCount = input(4);
  /** Kattintható oszlopok (mutató kurzor + `barClick` az oszlop kulcsával). */
  readonly clickable = input(false, { transform: booleanAttribute });
  readonly barClick = output<string>();

  readonly padLeft = PAD_LEFT;
  readonly padRight = PAD_RIGHT;
  readonly padTop = PAD_TOP;
  readonly padBottom = PAD_BOTTOM;

  private readonly plotH = computed(() => this.height() - PAD_TOP - PAD_BOTTOM);

  readonly max = computed(() =>
    Math.max(this.minMax(), ...this.columns().map((c) => c.segments.reduce((s, seg) => s + seg.value, 0))),
  );

  readonly ticks = computed<BarChartTick[]>(() => {
    const n = this.tickCount();
    const plotH = this.plotH();
    const max = this.max();
    return Array.from({ length: n + 1 }, (_, i) => ({ y: PAD_TOP + plotH - (i / n) * plotH, label: String(Math.round((max / n) * i)) }));
  });

  readonly bars = computed<BarChartBar[]>(() => {
    const columns = this.columns();
    const plotH = this.plotH();
    const step = (this.width() - PAD_LEFT - PAD_RIGHT) / Math.max(1, columns.length);
    const width = Math.max(2, Math.min(18, step * 0.7));
    const max = this.max();
    return columns.map((c, i) => {
      let base = PAD_TOP + plotH;
      const segments = c.segments.flatMap((seg) => {
        if (!seg.value) return [];
        const h = (seg.value / max) * plotH;
        base -= h;
        return [{ y: base, h, color: seg.color }];
      });
      return { key: c.key, x: PAD_LEFT + i * step + (step - width) / 2, width, label: c.label ?? '', title: c.title ?? '', segments };
    });
  });
}

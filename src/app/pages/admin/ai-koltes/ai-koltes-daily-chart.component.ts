import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AI_SOURCES, AiSpendingDayDto } from '../../../models/ai-spending.model';
import { UsdPipe } from '../../../shared/format/usd.pipe';

interface ChartBar {
  date: string;
  dayLabel: string;
  x: number;
  segments: { source: string; label: string; color: string; y: number; height: number; valueUsd: number }[];
  totalUsd: number;
}

const WIDTH = 860;
const HEIGHT = 220;
const PAD_LEFT = 40;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;
const PLOT_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM;

const dayTotal = (day: AiSpendingDayDto) => Object.values(day.bySource).reduce((s, v) => s + v, 0);

/**
 * Napi AI-költés forrás szerint halmozva (USD). Szándékosan nem a `shared/bar-chart`: ennek saját geometriája van
 * (40/24 px margó, `$` tengelyfelirat, 22 px-es oszlop, 1 px rés a szeletek között, szeletenkénti súgó), ezt a közös
 * komponens csak öt külön inputtal tudná. Attribútum-szelektor: a hívó adja az `svg` osztályait és akadálymentes nevét.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'svg[app-ai-koltes-daily-chart]',
  imports: [UsdPipe],
  host: { '[attr.viewBox]': "'0 0 ' + width + ' ' + height" },
  template: `
    @for (tick of yTicks(); track tick.y) {
      <svg:line [attr.x1]="padLeft" [attr.x2]="width - padRight" [attr.y1]="tick.y" [attr.y2]="tick.y"
        stroke="var(--color-border-default)" stroke-width="1" />
      <svg:text [attr.x]="padLeft - 8" [attr.y]="tick.y + 3" text-anchor="end" font-size="10" fill="var(--color-text-muted)">
        {{ tick.label }}
      </svg:text>
    }
    @for (bar of bars(); track bar.date) {
      @for (seg of bar.segments; track seg.source) {
        <svg:rect [attr.x]="bar.x" [attr.y]="seg.y" [attr.width]="barWidth()" [attr.height]="seg.height"
          [attr.fill]="seg.color" rx="2">
          <svg:title>{{ bar.dayLabel }} · {{ seg.label }}: {{ seg.valueUsd | usd }}</svg:title>
        </svg:rect>
      }
      @if (bar.totalUsd > 0) {
        <svg:rect [attr.x]="bar.x" [attr.y]="padTop" [attr.width]="barWidth()" [attr.height]="plotH" fill="transparent">
          <svg:title>{{ bar.dayLabel }} · összesen: {{ bar.totalUsd | usd }}</svg:title>
        </svg:rect>
      }
    }
  `,
})
export class AiKoltesDailyChartComponent {
  /** A megjelenítendő napok (már az időszakra vágva). */
  readonly days = input.required<readonly AiSpendingDayDto[]>();

  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly padLeft = PAD_LEFT;
  readonly padRight = PAD_RIGHT;
  readonly padTop = PAD_TOP;
  readonly plotH = PLOT_H;

  /** A skála felső értéke; legalább $0.5, hogy kis költésnél se legyen egy oszlop teljes magasságú. */
  readonly maxTotal = computed(() => Math.max(0.5, ...this.days().map(dayTotal)));

  readonly barWidth = computed(() => Math.min(22, PLOT_W / Math.max(1, this.days().length) - 4));

  readonly yTicks = computed(() => {
    const max = this.maxTotal();
    const ticks = 4;
    return Array.from({ length: ticks + 1 }, (_, i) => {
      const val = (max / ticks) * i;
      return { y: PAD_TOP + PLOT_H - (val / max) * PLOT_H, label: '$' + val.toFixed(val < 1 ? 1 : 0) };
    });
  });

  readonly bars = computed<ChartBar[]>(() => {
    const days = this.days();
    const step = PLOT_W / Math.max(1, days.length);
    const barW = this.barWidth();
    const max = this.maxTotal();

    return days.map((day, i) => {
      const x = PAD_LEFT + i * step + (step - barW) / 2;
      let yCursor = PAD_TOP + PLOT_H;
      const segments = AI_SOURCES.filter((s) => (day.bySource[s.key] ?? 0) > 0).map((s) => {
        const v = day.bySource[s.key] ?? 0;
        const h = (v / max) * PLOT_H;
        const y = yCursor - h;
        yCursor -= h;
        return { source: s.key, label: s.label, color: s.color, y, height: Math.max(0, h - 1), valueUsd: v };
      });
      const parsed = new Date(day.date);
      return {
        date: day.date,
        dayLabel: parsed.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }),
        x,
        segments,
        totalUsd: dayTotal(day),
      };
    });
  });
}

import { TestBed } from '@angular/core/testing';
import { AiKoltesDailyChartComponent } from './ai-koltes-daily-chart.component';
import { AiSpendingDayDto } from '../../../models/ai-spending.model';

describe('AiKoltesDailyChartComponent', () => {
  function render(days: AiSpendingDayDto[]) {
    const fixture = TestBed.createComponent(AiKoltesDailyChartComponent);
    fixture.componentRef.setInput('days', days);
    fixture.detectChanges();
    return fixture;
  }

  it('a skála legalább $0.5; üres napra nincs oszlop, csak a rácsvonalak', () => {
    const c = render([{ date: '2026-10-01', bySource: {} }]).componentInstance;
    expect(c.maxTotal()).toBe(0.5);
    expect(c.yTicks().map((t) => t.label)).toEqual(['$0.0', '$0.1', '$0.3', '$0.4', '$0.5']);
    expect(c.bars()[0].segments).toEqual([]);
    expect(c.bars()[0].totalUsd).toBe(0);
  });

  it('a szeletek alulról, AI_SOURCES-sorrendben halmozódnak 1 px réssel; az ismeretlen forrás csak a skálába számít', () => {
    const c = render([
      { date: '2026-10-01', bySource: { grading: 1, chat: 1 } },
      { date: '2026-10-02', bySource: { ismeretlen: 4 } },
    ]).componentInstance;
    expect(c.maxTotal()).toBe(4);
    const [first, second] = c.bars();
    // plotH = 186, 1 USD = 46.5 px; az első szelet (chat) az alapvonalról (y = 196) indul.
    expect(first.segments.map((s) => [s.source, s.y, s.height])).toEqual([
      ['chat', 149.5, 45.5],
      ['grading', 103, 45.5],
    ]);
    expect(second.segments).toEqual([]);
    expect(second.totalUsd).toBe(4);
  });

  it('az oszlopszélesség legfeljebb 22 px, sok napnál a lépésköz − 4', () => {
    const days = (n: number) => Array.from({ length: n }, (_, i) => ({ date: `2026-10-${i + 1}`, bySource: { chat: 1 } }));
    expect(render(days(7)).componentInstance.barWidth()).toBe(22);
    expect(render(days(58)).componentInstance.barWidth()).toBe(812 / 58 - 4);
  });

  it('a gazda svg viewBox-a 860×220; a súgó-téglalap csak nem nulla napra', () => {
    const fixture = render([
      { date: '2026-10-01', bySource: { chat: 0.25 } },
      { date: '2026-10-02', bySource: {} },
    ]);
    const el: SVGElement = fixture.nativeElement;
    expect(el.getAttribute('viewBox')).toBe('0 0 860 220');
    const titles = [...el.querySelectorAll('rect title')].map((t) => t.textContent?.trim());
    expect(titles).toEqual([
      expect.stringMatching(/ · AI Mentor \(diák chat\): \$0\.250$/),
      expect.stringMatching(/ · összesen: \$0\.250$/),
    ]);
  });
});

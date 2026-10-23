import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * Lapozó („Előző · oldal / összes oldal · Következő”). Attribútum-szelektor, így a konténer (és az elrendezése: gap, margó,
 * betűméret, megjelenítési feltétel) a hívó sablonjában marad. Két, ma használt megjelenés:
 * - `plain` (alapértelmezett): a régi lista-oldalak markupja, `<div class="pager" app-pager …>`;
 * - `ghost`: `btn btn-ghost` gombok nyilakkal, halvány oldalszám (ellenőrzés-típusú admin oldalak).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'div[app-pager]',
  template: `
    @if (variant() === 'ghost') {
      <button type="button" class="btn btn-ghost !px-3 !py-1.5" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)">← Előző</button>
      <span class="text-text-muted">{{ page() }} / {{ totalPages() }}</span>
      <button type="button" class="btn btn-ghost !px-3 !py-1.5" [disabled]="page() >= totalPages()" (click)="pageChange.emit(page() + 1)">Következő →</button>
    } @else {
      <button type="button" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)">Előző</button>
      <span>{{ page() }} / {{ totalPages() }}</span>
      <button type="button" [disabled]="page() >= totalPages()" (click)="pageChange.emit(page() + 1)">Következő</button>
    }
  `,
  // A régi lista-oldalak `.pager button` szabályai (a komponens-CSS nem ér át a gyerek komponensbe, ezért itt vannak).
  styles: `
    button:not(.btn) {
      background: var(--admin-surface-2);
      border: 1px solid var(--admin-border);
      color: var(--admin-text);
      border-radius: 0.375rem;
      padding: 0.375rem 0.75rem;
      cursor: pointer;
    }

    button:not(.btn):disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `,
})
export class PagerComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly variant = input<'plain' | 'ghost'>('plain');
  readonly pageChange = output<number>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
}

import { Pipe, PipeTransform } from '@angular/core';
import { formatUsd, formatUsdFine } from './number-utils';

/**
 * `{{ x | usd }}` → $0.012 / $1.25 (az AI-költés pult formája);
 * `{{ x | usd: 'fine' }}` → $0.0004 / $0.050 / $0.00 (a Projektműhely kis összegeihez, ld. `formatUsdFine`).
 */
@Pipe({ name: 'usd' })
export class UsdPipe implements PipeTransform {
  transform(value: number, precision: 'default' | 'fine' = 'default'): string {
    return precision === 'fine' ? formatUsdFine(value) : formatUsd(value);
  }
}

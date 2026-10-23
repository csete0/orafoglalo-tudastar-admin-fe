import { Pipe, PipeTransform } from '@angular/core';
import { formatUsd } from './number-utils';

/** `{{ x | usd }}` → $0.012 / $1.25 (az AI-költés pult formája). */
@Pipe({ name: 'usd' })
export class UsdPipe implements PipeTransform {
  transform(value: number): string {
    return formatUsd(value);
  }
}

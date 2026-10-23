import { Pipe, PipeTransform } from '@angular/core';
import { formatBytes, formatMb } from './number-utils';

/**
 * `{{ x | bytes }}` → 512 B / 1.5 KB / 2.0 MB;
 * `{{ x | bytes: 'MB' }}` → 2.0 (csak a szám, a „MB” felirat a sablonban van).
 */
@Pipe({ name: 'bytes' })
export class BytesPipe implements PipeTransform {
  transform(value: number, unit: 'auto' | 'MB' = 'auto'): string {
    return unit === 'MB' ? formatMb(value) : formatBytes(value);
  }
}

import { Pipe, PipeTransform } from '@angular/core';
import { percentOf } from './number-utils';

/** `{{ part | percentOf: whole }}` → százalék (0–100) számként; nulla nevezőnél 0. */
@Pipe({ name: 'percentOf' })
export class PercentOfPipe implements PipeTransform {
  transform(part: number, whole: number): number {
    return percentOf(part, whole);
  }
}

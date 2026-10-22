import { Pipe, PipeTransform } from '@angular/core';
import { asUtc } from '../../models/mock-exam.model';

/**
 * Az admin-API zóna nélkül küldött (UTC) időpontját UTC-ként olvassa, hogy utána a `date` pipe helyi (budapesti) időben írja ki:
 * `{{ x.createdAt | utc | date: 'yyyy.MM.dd' }}`. Üres értékre null (a `date` pipe üresen hagyja).
 */
@Pipe({ name: 'utc' })
export class UtcPipe implements PipeTransform {
  transform(value: string | null | undefined): Date | null {
    return value ? asUtc(value) : null;
  }
}

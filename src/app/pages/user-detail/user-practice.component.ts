import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PRACTICE_KIND_LABELS, PRACTICE_TIER_LABELS, PracticeGradeUserDetail } from '../../models/practice-grades.model';
import { UserPracticeCreditComponent } from './user-practice-credit.component';

/**
 * „Gyakorló értékelések” szakasz (PATRICKS-GYAKORLO-ERTEKELES-TERV.md, 6b): a keret állása, a kézi jóváírás és az értékelések.
 * `practice`: undefined = tölt, null = nem sikerült. A jóváírás válaszát (frissített keret) a `credited` adja tovább.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'section[app-user-practice]',
  imports: [DatePipe, UserPracticeCreditComponent],
  templateUrl: './user-practice.component.html',
  styleUrls: ['./user-detail-section.css', './user-practice.component.css'],
})
export class UserPracticeComponent {
  readonly userId = input.required<number>();
  readonly practice = input.required<PracticeGradeUserDetail | null | undefined>();
  readonly credited = output<PracticeGradeUserDetail>();
  readonly kindLabels = PRACTICE_KIND_LABELS;
  readonly tierLabels = PRACTICE_TIER_LABELS;
}

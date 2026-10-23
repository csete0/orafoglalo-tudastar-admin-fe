import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AuditLogService } from '../../services/audit-log/audit-log.service';
import { PagerComponent } from '../../shared/pager/pager.component';
import { latestValue } from '../../shared/resource/latest-value';

const PAGE_SIZE = 50;

type YesNoFilter = 'all' | 'true' | 'false';

@Component({
  selector: 'app-audit-log',
  imports: [ReactiveFormsModule, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-log.component.html',
  styleUrls: ['../list-page.css', './audit-log.component.css'],
})
export class AuditLogComponent {
  private readonly auditLogService = inject(AuditLogService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly pageSize = PAGE_SIZE;
  /** A szűrő-mezők; csak a Szűrés gombbal lépnek érvénybe (nem élő). */
  readonly form = this.fb.group({
    actorUserId: '',
    action: '',
    targetType: '',
    successFilter: this.fb.control<YesNoFilter>('all'),
    fromDate: '',
    toDate: '',
  });
  private readonly filter = signal(this.form.getRawValue());
  readonly page = signal(1);

  private readonly targetTypeList = rxResource({ stream: () => this.auditLogService.getTargetTypes() });
  readonly targetTypes = computed(() => (this.targetTypeList.hasValue() ? this.targetTypeList.value() : []));

  private readonly result = rxResource({
    // Az első oldal csak a TargetType-lista után töltődik (ahogy eddig); amíg az nincs meg, a resource nem kér semmit.
    params: () => {
      if (!this.targetTypeList.hasValue()) return undefined;
      const f = this.filter();
      return {
        actorUserId: f.actorUserId || undefined,
        action: f.action || undefined,
        targetType: f.targetType || undefined,
        success: f.successFilter === 'all' ? undefined : f.successFilter === 'true',
        fromUtc: f.fromDate ? new Date(f.fromDate).toISOString() : undefined,
        toUtc: f.toDate ? new Date(f.toDate).toISOString() : undefined,
        page: this.page(),
        pageSize: PAGE_SIZE,
      };
    },
    stream: ({ params }) => this.auditLogService.getPage(params),
  });
  private readonly latest = latestValue(this.result);
  readonly items = computed(() => this.latest()?.items ?? []);
  readonly totalCount = computed(() => this.latest()?.totalCount ?? 0);
  readonly isLoading = this.result.isLoading;

  search(): void {
    this.page.set(1);
    this.filter.set(this.form.getRawValue());
  }

  goToPage(page: number): void {
    if (page >= 1) this.page.set(page);
  }
}

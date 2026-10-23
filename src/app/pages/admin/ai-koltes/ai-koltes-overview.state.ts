import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminAiSpendingService } from '../../../services/admin/admin-ai-spending.service';
import { extractErrorMessage } from '../../../shared/http-error/extract-error-message.util';

/**
 * Az Áttekintés fül adatai. A pult (`AdminAiKoltesComponent`) `providers`-ében él, így fülváltáskor megmarad: az öt kérés
 * egyszer, a pult megnyitásakor indul, és a 7/30 napos nézet is megmarad. A mellékadatok (top költők, dolgozatok, teljes
 * vizsga, OpenRouter-egyenleg) hibája csak a saját csempéjüket érinti.
 */
@Injectable()
export class AiKoltesOverviewState {
  private readonly svc = inject(AdminAiSpendingService);

  private readonly overviewResource = rxResource({ stream: () => this.svc.getOverview(30) });
  private readonly topSpendersResource = rxResource({ stream: () => this.svc.getTopSpenders(30, 10) });
  private readonly classTestResource = rxResource({ stream: () => this.svc.getClassTestUsage() });
  private readonly fullExamResource = rxResource({ stream: () => this.svc.getFullExamUsage() });
  // Élő, közvetlen OpenRouter API-hívás: ha épp nem elérhető, a többi (DB-ből jövő) csempe ettől még megjelenik.
  private readonly creditsResource = rxResource({ stream: () => this.svc.getCredits() });

  readonly overview = computed(() => (this.overviewResource.hasValue() ? this.overviewResource.value() : null));
  readonly overviewLoading = this.overviewResource.isLoading;
  readonly overviewError = computed(() => {
    const err = this.overviewResource.error();
    return err ? extractErrorMessage(err, 'Az áttekintés betöltése sikertelen.') : null;
  });
  readonly topSpenders = computed(() => (this.topSpendersResource.hasValue() ? this.topSpendersResource.value() : []));
  readonly classTestUsage = computed(() => (this.classTestResource.hasValue() ? this.classTestResource.value() : []));
  readonly fullExam = computed(() => (this.fullExamResource.hasValue() ? this.fullExamResource.value() : null));
  readonly credits = computed(() => (this.creditsResource.hasValue() ? this.creditsResource.value() : null));
  readonly creditsError = computed(() => this.creditsResource.status() === 'error');

  /** A napi diagram és a jelmagyarázat időszaka (az adat mindig 30 napos). */
  readonly rangeDays = signal<7 | 30>(30);
}

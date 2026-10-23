import { Injectable, inject, signal } from '@angular/core';
import { AdminAiSpendingService } from '../../../services/admin/admin-ai-spending.service';
import { AutomationStatusDto } from '../../../models/ai-spending.model';
import { ToastService } from '../../../shared/toast/toast.service';
import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { extractErrorMessage } from '../../../shared/http-error/extract-error-message.util';

export function automationTitle(key: string): string {
  return key === 'studyplan' ? 'Tanulási terv újraszámítás' : key === 'dailychallenge' ? 'Napi kihívás előgenerálás' : key;
}

/**
 * Az Egyéb automatizmusok fül állapota: a token-fogyasztó háttérfolyamatok státusza és kézi indítása. A pult
 * `providers`-ében él, így fülváltáskor megmarad. Lusta: az első `start()`-kor tölt, kézi indítás után újratölt.
 */
@Injectable()
export class AiKoltesAutomationState {
  private readonly svc = inject(AdminAiSpendingService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly status = signal<AutomationStatusDto[]>([]);
  readonly loading = signal(false);
  /** Az épp indítás alatt álló folyamat kulcsa. */
  readonly triggering = signal<string | null>(null);

  private started = false;

  /** Az első betöltés (idempotens). */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.load();
  }

  async trigger(key: string): Promise<void> {
    const ok = await this.confirmService.ask({
      message: `Elindítod a(z) "${automationTitle(key)}" folyamatot kézzel, most?`,
      confirmLabel: 'Indítás',
    });
    if (!ok) return;

    this.triggering.set(key);
    const call = key === 'studyplan' ? this.svc.triggerStudyPlan() : this.svc.triggerDailyChallenge();
    call.subscribe({
      next: (res) => {
        this.triggering.set(null);
        this.toast.success(res.message);
        this.load();
      },
      error: (err) => {
        this.triggering.set(null);
        this.toast.danger(extractErrorMessage(err, 'A folyamat indítása sikertelen.'));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.svc.getAutomationStatus().subscribe({
      next: (data) => {
        this.status.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}

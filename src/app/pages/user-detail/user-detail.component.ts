import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UserService, UserDetail } from '../../services/users/user.service';
import { AdminProjektmuhelyService } from '../../services/admin/admin-projektmuhely.service';
import { ProjectAdminUserProject, RUNTIME_LABELS } from '../../models/projektmuhely.model';
import { AdminPracticeGradesService } from '../../services/admin/admin-practice-grades.service';
import { PRACTICE_KIND_LABELS, PRACTICE_TIER_LABELS, PracticeGradeUserDetail } from '../../models/practice-grades.model';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { extractErrorMessage } from '../../shared/http-error/extract-error-message.util';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './user-detail.component.html',
  styleUrl: './user-detail.component.css',
})
export class UserDetailComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly projects = inject(AdminProjektmuhelyService);
  private readonly practiceGrades = inject(AdminPracticeGradesService);
  private readonly confirmService = inject(ConfirmService);
  private userId!: number;

  readonly user = signal<UserDetail | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly actionBusy = signal(false);
  readonly actionMessage = signal<string | null>(null);
  /** Projektműhely-haladás (külön végpont: a többi szakasztól függetlenül töltődik). null = nem sikerült. */
  readonly userProjects = signal<ProjectAdminUserProject[] | null>([]);
  readonly runtimeLabels = RUNTIME_LABELS;

  /** Gyakorló értékelések + keret (külön végpont, mint a Projektműhely). undefined = tölt, null = nem sikerült. */
  readonly practice = signal<PracticeGradeUserDetail | null | undefined>(undefined);
  readonly kindLabels = PRACTICE_KIND_LABELS;
  readonly tierLabels = PRACTICE_TIER_LABELS;
  /** Kézi keret-jóváírás űrlapja (support eset, pl. „+5 ma”). */
  creditKind = 'code';
  creditAmount = 5;
  creditReason = '';
  readonly creditBusy = signal(false);
  readonly creditMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.userId = Number(this.route.snapshot.paramMap.get('id'));
    void firstValueFrom(this.projects.getUserProjects(this.userId)).then((p) => this.userProjects.set(p), () => this.userProjects.set(null));
    void firstValueFrom(this.practiceGrades.getUser(this.userId)).then(
      (p) => {
        this.practice.set(p);
        if (p.quotas.length && !p.quotas.some((q) => q.kind === this.creditKind)) this.creditKind = p.quotas[0].kind;
      },
      () => this.practice.set(null),
    );
    await this.reload();
    this.isLoading.set(false);
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── A3: három támogatói művelet ─────────────────────────────────

  async unlock(): Promise<void> {
    await this.runAction(() => this.userService.unlock(this.userId), 'Zárolás feloldva.');
  }

  async resendConfirmation(): Promise<void> {
    await this.runAction(
      () => this.userService.resendConfirmation(this.userId),
      'Megerősítő e-mail elküldve.',
    );
  }

  async confirmEmailManually(): Promise<void> {
    // SEC-4 (terv, kétlépcsős megerősítés): ez a diák/tanár fiókjának állapotát
    // közvetlenül módosítja token/link nélkül - admin-oldali megerősítés kell hozzá.
    if (!confirm('Biztosan kézzel megerősíted ennek a felhasználónak az e-mail-címét?')) {
      return;
    }
    await this.runAction(
      () => this.userService.confirmEmailManually(this.userId),
      'E-mail kézzel megerősítve.',
    );
  }

  // ── Gyakorló értékelés: kézi keret-jóváírás (naplózva) ─────────

  /** 1–50 közötti egész darab és nem üres indoklás kell (az indoklás az audit-naplóba kerül). */
  creditValid(): boolean {
    return Number.isInteger(this.creditAmount) && this.creditAmount >= 1 && this.creditAmount <= 50 && this.creditReason.trim().length > 0;
  }

  async grantCredit(): Promise<void> {
    if (!this.creditValid() || this.creditBusy()) return;
    const kind = this.kindLabels[this.creditKind] ?? this.creditKind;
    const ok = await this.confirmService.ask({
      title: 'Kézi keret-jóváírás',
      message: `+${this.creditAmount} gyakorló értékelés (${kind}) a mai napi és az e havi keretre. A jóváírás az audit-naplóba kerül. Folytatod?`,
      confirmLabel: 'Jóváírás',
    });
    if (!ok) return;

    this.creditBusy.set(true);
    this.creditMessage.set(null);
    try {
      this.practice.set(
        await firstValueFrom(
          this.practiceGrades.credit(this.userId, { kind: this.creditKind, amount: this.creditAmount, reason: this.creditReason.trim() }),
        ),
      );
      this.creditReason = '';
      this.creditMessage.set('Keret jóváírva.');
    } catch (err) {
      this.creditMessage.set(extractErrorMessage(err, 'A jóváírás sikertelen.'));
    } finally {
      this.creditBusy.set(false);
    }
  }

  private async runAction(action: () => Promise<void>, successMessage: string): Promise<void> {
    this.actionBusy.set(true);
    this.actionMessage.set(null);
    try {
      await action();
      this.actionMessage.set(successMessage);
      await this.reload();
    } catch {
      this.actionMessage.set('A művelet sikertelen.');
    } finally {
      this.actionBusy.set(false);
    }
  }

  private async reload(): Promise<void> {
    try {
      this.user.set(await this.userService.getDetail(this.userId));
    } catch {
      this.errorMessage.set('A felhasználó nem található.');
    }
  }
}

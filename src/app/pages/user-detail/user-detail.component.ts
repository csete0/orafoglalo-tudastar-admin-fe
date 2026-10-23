import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { UserService } from '../../services/users/user.service';
import { AdminProjektmuhelyService } from '../../services/admin/admin-projektmuhely.service';
import { AdminPracticeGradesService } from '../../services/admin/admin-practice-grades.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { UserTeacherProfileComponent } from './user-teacher-profile.component';
import { UserSubscriptionsComponent } from './user-subscriptions.component';
import { UserPaymentsComponent } from './user-payments.component';
import { UserGroupsParentsComponent } from './user-groups-parents.component';
import { UserProjectsComponent } from './user-projects.component';
import { UserPracticeComponent } from './user-practice.component';

@Component({
  selector: 'app-user-detail',
  imports: [
    RouterLink,
    UserTeacherProfileComponent,
    UserSubscriptionsComponent,
    UserPaymentsComponent,
    UserGroupsParentsComponent,
    UserProjectsComponent,
    UserPracticeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-detail.component.html',
  styleUrls: ['./user-detail-section.css', './user-detail.component.css'],
})
export class UserDetailComponent {
  private readonly userService = inject(UserService);
  private readonly projektmuhely = inject(AdminProjektmuhelyService);
  private readonly practiceGrades = inject(AdminPracticeGradesService);
  private readonly confirmService = inject(ConfirmService);

  /** A `users/:id` útvonal-paramétere (withComponentInputBinding). */
  readonly id = input.required<string>();
  readonly userId = computed(() => Number(this.id()));

  // A három szakasz külön végpontról, egymástól függetlenül (párhuzamosan) töltődik.
  readonly user = rxResource({
    params: () => this.userId(),
    stream: ({ params }) => this.userService.getDetail(params),
  });
  private readonly projectsResource = rxResource({
    params: () => this.userId(),
    stream: ({ params }) => this.projektmuhely.getUserProjects(params),
    defaultValue: [],
  });
  /** Projektműhely-haladás; null = nem sikerült. */
  readonly projects = computed(() => (this.projectsResource.error() ? null : this.projectsResource.value()));
  readonly practiceResource = rxResource({
    params: () => this.userId(),
    stream: ({ params }) => this.practiceGrades.getUser(params),
  });
  /** Gyakorló értékelések + keret; undefined = tölt, null = nem sikerült. */
  readonly practice = computed(() => (this.practiceResource.error() ? null : this.practiceResource.value()));

  private readonly actionRunning = signal(false);
  /** A támogatói műveletek gombjai a kérés és az utána következő újratöltés végéig tiltottak. */
  readonly actionBusy = computed(() => this.actionRunning() || this.user.isLoading());
  readonly actionMessage = signal<string | null>(null);

  // ── A3: három támogatói művelet ─────────────────────────────────

  unlock(): Promise<void> {
    return this.runAction(this.userService.unlock(this.userId()), 'Zárolás feloldva.');
  }

  resendConfirmation(): Promise<void> {
    return this.runAction(this.userService.resendConfirmation(this.userId()), 'Megerősítő e-mail elküldve.');
  }

  async confirmEmailManually(): Promise<void> {
    // SEC-4 (terv, kétlépcsős megerősítés): ez a diák/tanár fiókjának állapotát
    // közvetlenül módosítja token/link nélkül - admin-oldali megerősítés kell hozzá.
    const ok = await this.confirmService.ask({
      title: 'E-mail kézi megerősítése',
      message: 'Biztosan kézzel megerősíted ennek a felhasználónak az e-mail-címét?',
      confirmLabel: 'Megerősítés',
    });
    if (!ok) return;
    await this.runAction(this.userService.confirmEmailManually(this.userId()), 'E-mail kézzel megerősítve.');
  }

  private async runAction(action: Observable<void>, successMessage: string): Promise<void> {
    this.actionRunning.set(true);
    this.actionMessage.set(null);
    try {
      await firstValueFrom(action);
      this.actionMessage.set(successMessage);
      this.user.reload();
    } catch {
      this.actionMessage.set('A művelet sikertelen.');
    } finally {
      this.actionRunning.set(false);
    }
  }
}

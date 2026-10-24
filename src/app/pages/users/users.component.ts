import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService } from '../../services/users/user.service';
import { PagerComponent } from '../../shared/pager/pager.component';
import { latestValue } from '../../shared/resource/latest-value';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-users',
  imports: [ReactiveFormsModule, RouterLink, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users.component.html',
  styleUrl: '../list-page.css',
})
export class UsersComponent {
  private readonly userService = inject(UserService);

  readonly pageSize = PAGE_SIZE;
  /** A szűrő-mezők; csak a Keresés gombbal lépnek érvénybe (az üres mezőt a service nem küldi). */
  readonly form = inject(NonNullableFormBuilder).group({ query: '', role: '', subscriptionStatus: '' });
  private readonly filter = signal(this.form.getRawValue());
  readonly page = signal(1);

  private readonly result = rxResource({
    params: () => ({ ...this.filter(), page: this.page(), pageSize: PAGE_SIZE }),
    stream: ({ params }) => this.userService.search(params),
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

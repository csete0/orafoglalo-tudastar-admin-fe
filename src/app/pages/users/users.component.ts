import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService, UserSearchResult } from '../../services/users/user.service';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent implements OnInit {
  private readonly userService = inject(UserService);

  readonly items = signal<UserSearchResult[]>([]);
  readonly totalCount = signal(0);
  readonly page = signal(1);
  readonly isLoading = signal(false);

  query = '';
  role = '';
  subscriptionStatus = '';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async search(): Promise<void> {
    this.page.set(1);
    await this.load();
  }

  async goToPage(page: number): Promise<void> {
    if (page < 1) return;
    this.page.set(page);
    await this.load();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount() / PAGE_SIZE));
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    try {
      const result = await this.userService.search({
        query: this.query || undefined,
        role: this.role || undefined,
        subscriptionStatus: this.subscriptionStatus || undefined,
        page: this.page(),
        pageSize: PAGE_SIZE,
      });
      this.items.set(result.items);
      this.totalCount.set(result.totalCount);
    } finally {
      this.isLoading.set(false);
    }
  }
}

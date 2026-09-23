import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuditLogService, AdminAuditLogEntry } from '../../services/audit-log/audit-log.service';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.css',
})
export class AuditLogComponent implements OnInit {
  private readonly auditLogService = inject(AuditLogService);

  readonly items = signal<AdminAuditLogEntry[]>([]);
  readonly totalCount = signal(0);
  readonly page = signal(1);
  readonly isLoading = signal(false);
  readonly targetTypes = signal<string[]>([]);

  // Szűrő-mezők (ngModel) - csak Submit-kor lépnek érvénybe (nem élő).
  actorUserId = '';
  action = '';
  targetType = '';
  successFilter: 'all' | 'true' | 'false' = 'all';
  fromDate = '';
  toDate = '';

  async ngOnInit(): Promise<void> {
    this.targetTypes.set(await this.auditLogService.getTargetTypes());
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
      const result = await this.auditLogService.getPage({
        actorUserId: this.actorUserId || undefined,
        action: this.action || undefined,
        targetType: this.targetType || undefined,
        success: this.successFilter === 'all' ? undefined : this.successFilter === 'true',
        fromUtc: this.fromDate ? new Date(this.fromDate).toISOString() : undefined,
        toUtc: this.toDate ? new Date(this.toDate).toISOString() : undefined,
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

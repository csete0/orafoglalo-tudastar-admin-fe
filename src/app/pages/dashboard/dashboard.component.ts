import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { JUDGE0_STATUS_CLASSES, JUDGE0_STATUS_LABELS } from '../../models/judge0-load.model';
import { AdminJudge0LoadService } from '../../services/admin/admin-judge0-load.service';
import { ADMIN_TILES } from '../../admin-nav';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  /** A kódfuttató (Judge0) terhelés állapota az elmúlt 7 napra - kis jelvény a Kódfuttató terhelés oldalra. */
  protected readonly judge0Status = toSignal(
    inject(AdminJudge0LoadService).getReport(7).pipe(map((r) => r.status), catchError(() => of(null))),
    { initialValue: null },
  );
  protected readonly judge0Labels = JUDGE0_STATUS_LABELS;
  protected readonly judge0Classes = JUDGE0_STATUS_CLASSES;

  /** A csempék a menüvel közös listából (`ADMIN_NAV`). */
  protected readonly items = ADMIN_TILES;
}

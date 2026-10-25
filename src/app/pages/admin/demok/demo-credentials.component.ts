import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AdminDemoStore } from '../../../services/admin/admin-demo.store';

/**
 * A kiadott belépési adatok (D3): tanár + diákok e-mail/jelszó táblázata a belépési címekkel, nyomtatható. A jelszó csak most
 * látszik - a lista nem tárolja, később csak újragenerálással kérhető új.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-demo-credentials',
  template: `
    @if (store.credentials(); as c) {
      <section class="card p-5 border-warning/50" data-testid="demo-credentials">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-lg font-semibold">Belépési adatok – {{ c.environment.title }}</h2>
            <p class="text-sm text-warning mt-1 print:hidden">
              A jelszavak csak most látszanak; később csak újragenerálással kérhetsz újat.
            </p>
          </div>
          <div class="flex gap-2 print:hidden">
            <button type="button" class="btn btn-primary" (click)="print()" data-testid="demo-print">Nyomtatás</button>
            <button type="button" class="btn btn-ghost" (click)="store.dismissCredentials()">Bezárás</button>
          </div>
        </div>

        <dl class="grid sm:grid-cols-2 gap-2 text-sm mt-4">
          <div><dt class="text-text-muted">Diák-alkalmazás</dt><dd class="font-mono break-all">{{ c.studentAppUrl }}</dd></div>
          <div><dt class="text-text-muted">Tanári alkalmazás</dt><dd class="font-mono break-all">{{ c.teacherAppUrl }}</dd></div>
        </dl>

        <div class="overflow-x-auto mt-4">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-text-muted">
                <th class="py-1 pr-3">Szerep</th>
                <th class="py-1 pr-3">Név</th>
                <th class="py-1 pr-3">E-mail</th>
                <th class="py-1">Jelszó</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.key) {
                <tr class="border-t border-border-default" [attr.data-testid]="'cred-' + row.key">
                  <td class="py-1.5 pr-3">{{ row.role === 'teacher' ? 'Tanár' : 'Diák' }}</td>
                  <td class="py-1.5 pr-3">{{ row.name }}</td>
                  <td class="py-1.5 pr-3 font-mono break-all">{{ row.email }}</td>
                  <td class="py-1.5 font-mono">{{ row.password }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (c.environment.kind === 'owner') {
          <p class="text-xs text-text-muted mt-3">
            A saját demóba jelszóval lépj be - a Google-belépés a plusz-címhez nem a demó-fiókot, hanem a valódi fiókodat hozza.
          </p>
        }
      </section>
    }
  `,
})
export class DemoCredentialsComponent {
  readonly store = inject(AdminDemoStore);
  readonly rows = computed(() => this.store.credentials()?.credentials ?? []);

  print(): void {
    window.print();
  }
}

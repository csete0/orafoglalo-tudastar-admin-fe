import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { AdminJudge0LoadService } from '../../services/admin/admin-judge0-load.service';
import { JUDGE0_STATUS_CLASSES, JUDGE0_STATUS_LABELS, Judge0LoadReport, Judge0LoadStatus } from '../../models/judge0-load.model';

/** Karakterizáció (WP-A2): a kezdőlap csempéi és a Judge0-jelvény mostani viselkedése. */
describe('DashboardComponent', () => {
  let getReport: ReturnType<typeof vi.fn>;

  async function render() {
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([]), { provide: AdminJudge0LoadService, useValue: { getReport } }],
    });
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const report = (status: Judge0LoadStatus): Observable<Judge0LoadReport> => of({ status } as Judge0LoadReport);

  it('a 7 napos Judge0-állapotot jelvényként mutatja, a terhelés-oldalra linkelve', async () => {
    getReport = vi.fn(() => report('red'));
    const el = await render();

    expect(getReport).toHaveBeenCalledWith(7);
    const badge = el.querySelector<HTMLAnchorElement>('a.judge0-badge');
    expect(badge).not.toBeNull();
    expect(badge!.getAttribute('href')).toBe('/kodfuttato-terheles');
    expect(badge!.textContent?.trim()).toBe(`Kódfuttató: ${JUDGE0_STATUS_LABELS.red}`);
    for (const cls of JUDGE0_STATUS_CLASSES.red.split(/\s+/).filter(Boolean)) {
      expect(badge!.classList).toContain(cls);
    }
  });

  it('a jelentés hibájánál nincs jelvény, az oldal betölt', async () => {
    getReport = vi.fn(() => throwError(() => new Error('500')));
    const el = await render();

    expect(el.querySelector('.judge0-badge')).toBeNull();
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Kezdőlap');
  });

  it('a csempék sorrendje és útvonala változatlan', async () => {
    getReport = vi.fn(() => report('green'));
    const el = await render();

    const tiles = Array.from(el.querySelectorAll('ul.upcoming li')).map((li) => [
      li.querySelector('.label')?.textContent?.trim(),
      li.querySelector('a.label')?.getAttribute('href') ?? null,
    ]);
    expect(tiles).toEqual([
      ['Audit-napló', '/audit-log'],
      ['Ajándékkód-kezelés', '/gift-coupons'],
      ['Felhasználó-kereső / 360°', '/users'],
      ['Támogatói műveletek', '/users'],
      ['Fizetés-lista', '/payments'],
      ['Tanári aktivitás', '/tanarok'],
      ['Alkalmazás-állapot', '/app-status'],
      ['Kódfuttató terhelés', '/kodfuttato-terheles'],
      ['Tanári jelentkezések', '/jelentkezesek'],
      ['Intézményi licencek', '/intezmenyek'],
      ['Kérdés-jelentések / érdeklődések', '/ellenorzes'],
      ['Kuponkódok (általános)', '/kuponok'],
      ['AI-költés pult', '/ai-koltes'],
      ['Projektműhely', '/projektmuhely'],
      ['Git', '/git'],
      ['Növekedés', '/novekedes'],
      ['Érettségi-eredmények', '/erettsegi-eredmenyek'],
      ['Szempontlisták', '/szempontlistak'],
      ['Gyakorló értékelések', '/gyakorlo-ertekelesek'],
    ]);
  });
});

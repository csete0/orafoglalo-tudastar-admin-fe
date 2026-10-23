import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AppStatusComponent } from './app-status.component';
import { AppStatusResult } from '../../services/app-status/app-status.service';
import { environment } from '../../../environments/environment';

const URL_ = `${environment.apiUrl}/app-status`;

const status = (name: string, overrides: Partial<AppStatusResult> = {}): AppStatusResult => ({
  name, isHealthy: true, statusCode: 200, responseTimeMs: 12, error: null, ...overrides,
});

/** Karakterizáció (WP-A2): az alkalmazás-állapot oldal mostani viselkedése (valódi AppStatusService + HttpTestingController). */
describe('AppStatusComponent', () => {
  let fixture: ComponentFixture<AppStatusComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  /** A flush utáni Promise-lánc (firstValueFrom → await → signal) lefutása, utána render. */
  async function settle() {
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  }
  const button = () => el.querySelector<HTMLButtonElement>('.header-row button')!;
  const errorText = () => el.querySelector('.error')?.textContent?.trim() ?? null;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppStatusComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AppStatusComponent);
    el = fixture.nativeElement;
    // Nincs whenStable(): a függő kérés (resource) a flush-ig nyitva tartja az app stabilitását.
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('betöltés közben tiltott „Frissítés...” gomb és „Betöltés...”', () => {
    fixture.detectChanges();
    expect(button().disabled).toBe(true);
    expect(button().textContent?.trim()).toBe('Frissítés...');
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('Betöltés...');
    http.expectOne(URL_).flush([]);
  });

  it('a célokat állapot szerint írja ki: OK + idő, HTTP-kód, hibaszöveg, „Nem elérhető”', async () => {
    http.expectOne(URL_).flush([
      status('api'),
      status('teacher-fe', { isHealthy: false, statusCode: 503 }),
      status('judge0', { isHealthy: false, statusCode: null, error: 'Timeout' }),
      status('redis', { isHealthy: false, statusCode: null, error: null }),
    ]);
    await settle();

    const items = Array.from(el.querySelectorAll('.status-list li'));
    expect(items.map((li) => li.querySelector('.name')?.textContent?.trim())).toEqual(['api', 'teacher-fe', 'judge0', 'redis']);
    expect(items.map((li) => li.querySelector('.detail')?.textContent?.replace(/\s+/g, ' ').trim()))
      .toEqual(['OK · 12 ms', 'HTTP 503', 'Timeout', 'Nem elérhető']);
    expect(items.map((li) => li.classList.contains('down'))).toEqual([false, true, true, true]);
    expect(items.map((li) => li.querySelector('.dot')!.classList.contains('up'))).toEqual([true, false, false, false]);
    expect(button().disabled).toBe(false);
    expect(button().textContent?.trim()).toBe('Frissítés');
    expect(errorText()).toBeNull();
  });

  it('üres listánál „Nincs beállított cél.”', async () => {
    http.expectOne(URL_).flush([]);
    await settle();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('Nincs beállított cél.');
  });

  it('hibánál üzenetet ír, a korábbi lista marad; a Frissítés újrakér és törli a hibaüzenetet', async () => {
    http.expectOne(URL_).flush([status('api')]);
    await settle();

    button().click();
    fixture.detectChanges(); // a resource a következő változás-észleléskor indítja a kérést
    http.expectOne(URL_).flush(null, { status: 502, statusText: 'Bad Gateway' });
    await settle();
    expect(errorText()).toBe('Az állapot-lekérdezés sikertelen.');
    expect(el.querySelectorAll('.status-list li:not(.empty)').length).toBe(1);
    expect(button().disabled).toBe(false);

    button().click();
    fixture.detectChanges();
    expect(errorText()).toBeNull();
    http.expectOne(URL_).flush([status('api'), status('judge0')]);
    await settle();
    expect(el.querySelectorAll('.status-list li:not(.empty)').length).toBe(2);
  });
});

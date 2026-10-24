import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import { ConfirmService } from './shared/confirm/confirm.service';
import { AuthStore } from './services/auth/auth.store';
import { HangfireService } from './services/hangfire/hangfire.service';
import { ToastService } from './shared/toast/toast.service';

const SESSION_KEY = 'patricks-admin-session';

// A tanári felületről áthozott oldalak a ConfirmService-re és a ToastService-re építenek,
// amik csak akkor jelennek meg, ha a hosztjuk a gyökérben van. Hiányukban a megerősítést
// kérő műveletek (licenc visszavonása, kupon inaktiválása...) csendben elakadtak.
describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('a gyökérben ott a megerősítő ablak és az értesítő hosztja', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-confirm-dialog')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-toast')).not.toBeNull();
  });

  it('a ConfirmService kérdése a gyökérből ténylegesen megjelenik', () => {
    const fixture = TestBed.createComponent(AppComponent);
    TestBed.inject(ConfirmService).ask({ message: 'Biztosan visszavonod?', confirmLabel: 'Visszavonás' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="confirm-dialog"]')?.textContent)
      .toContain('Biztosan visszavonod?');
  });

  describe('fejléc és menü (karakterizáció, WP-D1)', () => {
    function login() {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ accessToken: 't', expiresAtMs: Date.now() + 3_600_000, email: 'a@b.hu', displayName: 'Teszt Admin' }),
      );
    }
    afterEach(() => sessionStorage.clear());

    it('belépés nélkül nincs fejléc', () => {
      sessionStorage.clear();
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('header.topbar')).toBeNull();
    });

    it('belépve a menüpontok sorrendje, felirata és útvonala változatlan', () => {
      login();
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;

      const links = Array.from(el.querySelectorAll('header .nav a')).map((a) => [a.textContent?.trim(), a.getAttribute('href')]);
      expect(links).toEqual([
        ['Kezdőlap', '/'],
        ['Felhasználók', '/users'],
        ['Ajándékkódok', '/gift-coupons'],
        ['Fizetések', '/payments'],
        ['Audit-napló', '/audit-log'],
        ['Alkalmazás-állapot', '/app-status'],
        ['Kódfuttató terhelés', '/kodfuttato-terheles'],
        ['Jelentkezések', '/jelentkezesek'],
        ['Tanárok', '/tanarok'],
        ['Intézmények', '/intezmenyek'],
        ['Ellenőrzés', '/ellenorzes'],
        ['AI-költés', '/ai-koltes'],
        ['Projektműhely', '/projektmuhely'],
        ['Git', '/git'],
        ['Csapatok', '/csapatok'],
        ['Növekedés', '/novekedes'],
        ['Próbaérettségi', '/probaerettsegi'],
        ['Érettségi-eredmények', '/erettsegi-eredmenyek'],
        ['Szempontlisták', '/szempontlistak'],
        ['Gyakorló értékelések', '/gyakorlo-ertekelesek'],
        ['Verseny', '/verseny'],
        ['Háttérfeladatok', '#'],
      ]);
      expect(el.querySelector('header .who span')?.textContent?.trim()).toBe('Teszt Admin');
    });

    it('az aktív menüpont kiemelt (a Kezdőlap csak pontos egyezésnél)', async () => {
      login();
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      const router = TestBed.inject(Router);
      router.resetConfig([{ path: '**', children: [] }]);
      await router.navigateByUrl('/users');
      fixture.detectChanges();
      await fixture.whenStable();
      const active = Array.from(fixture.nativeElement.querySelectorAll('header .nav a.active')).map((a) =>
        (a as HTMLElement).textContent?.trim(),
      );
      expect(active).toEqual(['Felhasználók']);
    });

    it('a Kijelentkezés törli a munkamenetet, elrejti a fejlécet és a /login-ra visz', () => {
      login();
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      (fixture.nativeElement.querySelector('header .who button') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(TestBed.inject(AuthStore).isAuthenticated()).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/login']);
      expect(fixture.nativeElement.querySelector('header.topbar')).toBeNull();
    });

    it('a Háttérfeladatok megnyitja a Hangfire-t; hibánál értesítés', async () => {
      login();
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      const open = vi.spyOn(TestBed.inject(HangfireService), 'openDashboard').mockResolvedValueOnce();
      const danger = vi.spyOn(TestBed.inject(ToastService), 'danger');
      const link = () => Array.from(fixture.nativeElement.querySelectorAll('header .nav a')).at(-1) as HTMLAnchorElement;

      const event = new MouseEvent('click', { cancelable: true });
      link().dispatchEvent(event);
      await fixture.whenStable();
      expect(event.defaultPrevented).toBe(true);
      expect(open).toHaveBeenCalledTimes(1);
      expect(danger).not.toHaveBeenCalled();

      open.mockRejectedValueOnce(new Error('403'));
      link().click();
      await new Promise((r) => setTimeout(r));
      expect(danger).toHaveBeenCalledWith('A háttérfeladatok felülete nem nyitható meg.');
    });
  });
});

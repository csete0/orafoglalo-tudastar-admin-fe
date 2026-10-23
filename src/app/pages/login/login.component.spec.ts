import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthStore } from '../../services/auth/auth.store';

/** Karakterizáció (WP-A2): belépés, a backend egységes hibaüzenete, dupla beküldés elleni védelem. */
describe('LoginComponent', () => {
  let login: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function render() {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: AuthStore, useValue: { login } }],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  async function fillAndSubmit(fixture: Awaited<ReturnType<typeof render>>, email: string, password: string) {
    const el: HTMLElement = fixture.nativeElement;
    const emailInput = el.querySelector<HTMLInputElement>('input[name="email"]')!;
    const passwordInput = el.querySelector<HTMLInputElement>('input[name="password"]')!;
    emailInput.value = email;
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.value = password;
    passwordInput.dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const errorText = (el: HTMLElement) => el.querySelector('.error')?.textContent?.trim() ?? null;

  beforeEach(() => {
    login = vi.fn(() => Promise.resolve());
  });

  it('sikeres belépés után a kezdőlapra visz', async () => {
    const fixture = await render();
    await fillAndSubmit(fixture, 'admin@example.com', 'titok');

    expect(login).toHaveBeenCalledWith('admin@example.com', 'titok');
    expect(navigate).toHaveBeenCalledWith(['/']);
    expect(errorText(fixture.nativeElement)).toBeNull();
  });

  it('üres mezőkkel is beküld (a böngésző-validáció ki van kapcsolva, a backend dönt)', async () => {
    const fixture = await render();
    await fillAndSubmit(fixture, '', '');
    expect(login).toHaveBeenCalledWith('', '');
  });

  it('a backend errorMessage mezőjét írja ki', async () => {
    login.mockRejectedValue(new HttpErrorResponse({ status: 401, error: { errorMessage: 'Hibás e-mail vagy jelszó.', error: 'más' } }));
    const fixture = await render();
    await fillAndSubmit(fixture, 'a@b.hu', 'x');

    expect(errorText(fixture.nativeElement)).toBe('Hibás e-mail vagy jelszó.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('errorMessage híján az error mezőt írja ki', async () => {
    login.mockRejectedValue(new HttpErrorResponse({ status: 429, error: { error: 'Túl sok próbálkozás.' } }));
    const fixture = await render();
    await fillAndSubmit(fixture, 'a@b.hu', 'x');

    expect(errorText(fixture.nativeElement)).toBe('Túl sok próbálkozás.');
  });

  it('ismeretlen hibára generikus szöveg', async () => {
    login.mockRejectedValue(new Error('hálózat'));
    const fixture = await render();
    await fillAndSubmit(fixture, 'a@b.hu', 'x');
    expect(errorText(fixture.nativeElement)).toBe('Sikertelen bejelentkezés.');

    login.mockRejectedValue(new HttpErrorResponse({ status: 500, error: 'szöveges test' }));
    await fillAndSubmit(fixture, 'a@b.hu', 'x');
    expect(errorText(fixture.nativeElement)).toBe('Sikertelen bejelentkezés.');
  });

  it('új beküldéskor a korábbi hibaüzenet eltűnik', async () => {
    login.mockRejectedValueOnce(new Error('x'));
    const fixture = await render();
    await fillAndSubmit(fixture, 'a@b.hu', 'x');
    expect(errorText(fixture.nativeElement)).not.toBeNull();

    await fillAndSubmit(fixture, 'a@b.hu', 'jo');
    expect(errorText(fixture.nativeElement)).toBeNull();
  });

  it('folyamatban lévő belépés alatt a gomb tiltott, és a második beküldés nem indít új hívást', async () => {
    let resolve!: () => void;
    login.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    const fixture = await render();
    const component = fixture.componentInstance;
    const el: HTMLElement = fixture.nativeElement;

    const first = component.submit();
    fixture.detectChanges();
    const button = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBe(true);
    expect(button.textContent?.trim()).toBe('Belépés...');

    await component.submit();
    expect(login).toHaveBeenCalledTimes(1);

    resolve();
    await first;
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    expect(button.textContent?.trim()).toBe('Belépés');
  });
});

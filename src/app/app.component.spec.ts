import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import { ConfirmService } from './shared/confirm/confirm.service';

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
});

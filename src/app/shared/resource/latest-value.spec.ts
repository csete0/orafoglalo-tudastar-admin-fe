import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { rxResource } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { latestValue } from './latest-value';

/** Az rxResource az első értéket Promise-on át adja át; egy makrotask-kör után már a signalban van. */
const settle = () => new Promise((r) => setTimeout(r));

describe('latestValue', () => {
  it('betöltés közben és hiba után a korábbi sikeres értéket adja, új siker után az újat', async () => {
    const injector = TestBed.inject(Injector);
    const page = signal(1);
    let response = new Subject<string>();
    const res = rxResource({ params: () => page(), stream: () => (response = new Subject<string>()), injector });
    const latest = latestValue(res);

    TestBed.tick();
    expect(latest()).toBeUndefined();
    response.next('első');
    await settle();
    expect(latest()).toBe('első');

    page.set(2);
    TestBed.tick();
    expect(res.isLoading()).toBe(true);
    expect(latest()).toBe('első');

    response.error(new Error('500'));
    await settle();
    expect(res.status()).toBe('error');
    expect(latest()).toBe('első');

    page.set(3);
    TestBed.tick();
    response.next('harmadik');
    await settle();
    expect(latest()).toBe('harmadik');
  });
});

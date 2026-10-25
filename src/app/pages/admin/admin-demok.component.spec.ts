import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminDemokComponent } from './admin-demok.component';
import { AdminDemoService } from '../../services/admin/admin-demo.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { demoCredentials, demoEnv } from './demok/demok.spec-data';

/** Demók oldal (PATRICKS-DEMO-KORNYEZET-TERV.md F5): lista, saját demó űrlap, nyomtatható belépési adatok, megerősítések. */
describe('AdminDemokComponent', () => {
  let svc: Record<string, ReturnType<typeof vi.fn>>;
  let ask: ReturnType<typeof vi.fn>;

  function render() {
    TestBed.configureTestingModule({
      imports: [AdminDemokComponent],
      providers: [{ provide: AdminDemoService, useValue: svc }, { provide: ConfirmService, useValue: { ask } }],
    });
    const fixture = TestBed.createComponent(AdminDemokComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    ask = vi.fn(() => Promise.resolve(true));
    svc = {
      list: vi.fn(() => of([demoEnv()])),
      createOwner: vi.fn(() => of({ ...demoCredentials, environment: demoEnv({ kind: 'owner' }) })),
      delete: vi.fn(() => of(demoEnv({ status: 'deleting' }))),
      reset: vi.fn(() => of(demoEnv({ status: 'resetting' }))),
    };
  });

  it('saját demó nélkül az alapértelmezett címalappal kínálja a létrehozást, az iskolai demó kártyája látszik', () => {
    const el: HTMLElement = render().nativeElement;
    expect((el.querySelector('#owner-email') as HTMLInputElement).value).toBe('csete6@gmail.com');
    expect(el.querySelector('[data-testid="demo-1"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="demo-status"]')?.textContent).toContain('Aktív');
  });

  it('a saját demó létrehozása után a belépési adatok nyomtatható panelen látszanak', () => {
    const fixture = render();
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('[data-testid="owner-form"]') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(svc['createOwner']).toHaveBeenCalledWith({ emailBase: 'csete6@gmail.com' });
    expect(el.querySelector('[data-testid="cred-diak1"]')?.textContent).toContain('Eper-5678-szilva');
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    (el.querySelector('[data-testid="demo-print"]') as HTMLButtonElement).click();
    expect(print).toHaveBeenCalled();
  });

  it('a törlés veszélyes megerősítést kér, és csak igen után indul', async () => {
    const fixture = render();
    const el: HTMLElement = fixture.nativeElement;
    ask.mockResolvedValueOnce(false);
    (el.querySelector('[data-testid="demo-delete"]') as HTMLButtonElement).click();
    await Promise.resolve();
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ danger: true }));
    expect(svc['delete']).not.toHaveBeenCalled();
    (el.querySelector('[data-testid="demo-delete"]') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    expect(svc['delete']).toHaveBeenCalledWith(1);
  });
});

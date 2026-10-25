import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AdminDemoService } from './admin-demo.service';
import {
  CreateOwnerDemoRequest,
  CreateSchoolDemoRequest,
  DemoCredentials,
  DemoEnvironment,
  ExtendDemoRequest,
} from '../../models/demo.model';

/** Futó betöltés/törlés közben ilyen időközönként frissül a lista (a motor a háttérben dolgozik). */
export const DEMO_POLL_MS = 3000;

/**
 * A Demók oldal állapota (PATRICKS-DEMO-KORNYEZET-TERV.md F5): a lista, a műveletek és az egyszer látszó belépési adatok.
 * Amíg valamelyik demó betöltés/törlés alatt áll, a lista magától frissül. Az oldal saját példánya (a komponens `providers`-e):
 * az oldal elhagyásakor a frissítés leáll, és a kiadott jelszavak sem maradnak a memóriában.
 */
@Injectable()
export class AdminDemoStore implements OnDestroy {
  private readonly service = inject(AdminDemoService);

  private readonly _demos = signal<DemoEnvironment[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _mutating = signal(false);
  private readonly _busyId = signal<number | null>(null);
  private readonly _error = signal<string | null>(null);
  private readonly _credentials = signal<DemoCredentials | null>(null);
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  readonly demos = this._demos.asReadonly();
  /** A lista töltődik (a háttér-frissítés is) - a gombokat nem tiltja. */
  readonly loading = this._loading.asReadonly();
  /** Az első lekérés lezárult (addig a saját demó űrlapja sem villan fel). */
  readonly loaded = this._loaded.asReadonly();
  /** Létrehozás / művelet fut - ilyenkor a gombok tiltottak. */
  readonly mutating = this._mutating.asReadonly();
  readonly busyId = this._busyId.asReadonly();
  readonly error = this._error.asReadonly();
  /** Az utoljára kiadott belépési adatok - csak most látszanak, a lista nem tárolja a jelszót (D3). */
  readonly credentials = this._credentials.asReadonly();
  readonly ownerDemo = computed(() => this._demos().find((d) => d.kind === 'owner') ?? null);
  readonly schoolDemos = computed(() => this._demos().filter((d) => d.kind === 'school'));

  load(): void {
    this.stopPoll();
    this._loading.set(true);
    this.service
      .list()
      .pipe(finalize(() => { this._loading.set(false); this._loaded.set(true); }))
      .subscribe({
        next: (demos) => {
          this._demos.set(demos);
          this.schedulePoll(demos);
        },
        error: (err: HttpErrorResponse) => {
          this._error.set(message(err, 'A demók betöltése sikertelen.'));
          // Futó művelet mellett egy hálózati hiba se állítsa le a frissítést.
          this.schedulePoll(this._demos());
        },
      });
  }

  createSchool(request: CreateSchoolDemoRequest, onSuccess: () => void): void {
    this.mutate(this.service.createSchool(request), 'Az iskolai demó létrehozása sikertelen.', (result) => {
      this._credentials.set(result);
      onSuccess();
    });
  }

  createOwner(request: CreateOwnerDemoRequest): void {
    this.mutate(this.service.createOwner(request), 'A saját demó létrehozása sikertelen.', (result) => this._credentials.set(result));
  }

  regeneratePasswords(id: number): void {
    this.mutate(this.service.regeneratePasswords(id), 'Az új jelszavak kiadása sikertelen.', (result) => this._credentials.set(result), id);
  }

  extend(id: number, request: ExtendDemoRequest, onSuccess?: () => void): void {
    this.mutate(this.service.extend(id, request), 'A hosszabbítás sikertelen.', () => onSuccess?.(), id);
  }

  reset(id: number): void {
    this.mutate(this.service.reset(id), 'A visszaállítás indítása sikertelen.', () => undefined, id);
  }

  delete(id: number): void {
    this.mutate(this.service.delete(id), 'A törlés indítása sikertelen.', () => undefined, id);
  }

  dismissCredentials(): void {
    this._credentials.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopPoll();
    this._credentials.set(null);
  }

  /** Egyszerre egy művelet; utána a lista újratöltődik (a háttér-frissítés nem akadályozza). */
  private mutate<T>(request: Observable<T>, fallback: string, onSuccess: (result: T) => void, busyId: number | null = null): void {
    if (this._mutating()) return;
    this._mutating.set(true);
    this._busyId.set(busyId);
    this._error.set(null);
    request.pipe(finalize(() => { this._mutating.set(false); this._busyId.set(null); })).subscribe({
      next: (result) => {
        onSuccess(result);
        this.load();
      },
      error: (err: HttpErrorResponse) => this._error.set(message(err, fallback)),
    });
  }

  private schedulePoll(demos: DemoEnvironment[]): void {
    this.stopPoll();
    if (!this.destroyed && demos.some((d) => d.status === 'resetting' || d.status === 'deleting')) {
      this.pollTimer = setTimeout(() => this.load(), DEMO_POLL_MS);
    }
  }

  private stopPoll(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }
}

function message(err: HttpErrorResponse, fallback: string): string {
  const body: unknown = err.error;
  if (body && typeof body === 'object' && 'errorMessage' in body && typeof body.errorMessage === 'string') return body.errorMessage;
  return fallback;
}

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
 * Amíg valamelyik demó betöltés/törlés alatt áll, a lista magától frissül.
 */
@Injectable({ providedIn: 'root' })
export class AdminDemoStore implements OnDestroy {
  private readonly service = inject(AdminDemoService);

  private readonly _demos = signal<DemoEnvironment[]>([]);
  private readonly _loading = signal(false);
  private readonly _busyId = signal<number | null>(null);
  private readonly _error = signal<string | null>(null);
  private readonly _credentials = signal<DemoCredentials | null>(null);
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  readonly demos = this._demos.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly busyId = this._busyId.asReadonly();
  readonly error = this._error.asReadonly();
  /** Az utoljára kiadott belépési adatok - csak most látszanak, a lista nem tárolja a jelszót (D3). */
  readonly credentials = this._credentials.asReadonly();
  readonly ownerDemo = computed(() => this._demos().find((d) => d.kind === 'owner') ?? null);
  readonly schoolDemos = computed(() => this._demos().filter((d) => d.kind === 'school'));

  load(): void {
    this._loading.set(true);
    this.service
      .list()
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: (demos) => {
          this._demos.set(demos);
          this.schedulePoll(demos);
        },
        error: (err: HttpErrorResponse) => this._error.set(message(err, 'A demók betöltése sikertelen.')),
      });
  }

  createSchool(request: CreateSchoolDemoRequest, onSuccess: () => void): void {
    this.issue(this.service.createSchool(request), 'Az iskolai demó létrehozása sikertelen.', onSuccess);
  }

  createOwner(request: CreateOwnerDemoRequest, onSuccess: () => void): void {
    this.issue(this.service.createOwner(request), 'A saját demó létrehozása sikertelen.', onSuccess);
  }

  regeneratePasswords(id: number): void {
    this.issue(this.service.regeneratePasswords(id), 'Az új jelszavak kiadása sikertelen.', undefined, id);
  }

  extend(id: number, request: ExtendDemoRequest, onSuccess?: () => void): void {
    this.run(id, this.service.extend(id, request), 'A hosszabbítás sikertelen.', onSuccess);
  }

  reset(id: number): void {
    this.run(id, this.service.reset(id), 'A visszaállítás indítása sikertelen.');
  }

  delete(id: number): void {
    this.run(id, this.service.delete(id), 'A törlés indítása sikertelen.');
  }

  dismissCredentials(): void {
    this._credentials.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  ngOnDestroy(): void {
    this.stopPoll();
  }

  private issue(request: Observable<DemoCredentials>, fallback: string, onSuccess?: () => void, busyId: number | null = null): void {
    if (this._loading()) return;
    this._loading.set(true);
    this._busyId.set(busyId);
    this._error.set(null);
    request.pipe(finalize(() => { this._loading.set(false); this._busyId.set(null); })).subscribe({
      next: (result) => {
        this._credentials.set(result);
        onSuccess?.();
        this.load();
      },
      error: (err: HttpErrorResponse) => this._error.set(message(err, fallback)),
    });
  }

  private run(id: number, request: Observable<DemoEnvironment>, fallback: string, onSuccess?: () => void): void {
    if (this._busyId() !== null) return;
    this._busyId.set(id);
    this._error.set(null);
    request.pipe(finalize(() => this._busyId.set(null))).subscribe({
      next: () => {
        onSuccess?.();
        this.load();
      },
      error: (err: HttpErrorResponse) => this._error.set(message(err, fallback)),
    });
  }

  private schedulePoll(demos: DemoEnvironment[]): void {
    this.stopPoll();
    if (demos.some((d) => d.status === 'resetting' || d.status === 'deleting')) {
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

import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface AdminLoginResponse {
  accessToken: string;
  expiresIn: number;
  email: string;
  displayName: string;
}

interface StoredSession {
  accessToken: string;
  expiresAtMs: number;
  email: string;
  displayName: string;
}

const STORAGE_KEY = 'patricks-admin-session';

/**
 * ADM-F1: az admin-token NINCS refresh-elve (a terv "rövid élettartam"
 * követelménye szándékosan egyszerű - lejáratkor a felhasználó újra
 * bejelentkezik, nincs csendes token-megújítási logika, ami hosszabbra
 * nyújtaná a valódi élettartamot). sessionStorage-ban tárol (NEM
 * localStorage) - egy megosztott/nyilvános gépen a böngésző bezárásával a
 * munkamenet is megszűnik, ami egy belső támogatói eszköznél a biztonságosabb
 * alapértelmezés.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly session = signal<StoredSession | null>(this.loadFromStorage());

  readonly isAuthenticated = computed(() => {
    const s = this.session();
    return s !== null && s.expiresAtMs > Date.now();
  });

  readonly displayName = computed(() => this.session()?.displayName ?? '');
  readonly email = computed(() => this.session()?.email ?? '');

  constructor(private readonly http: HttpClient) {}

  getAccessToken(): string | null {
    const s = this.session();
    if (!s || s.expiresAtMs <= Date.now()) {
      return null;
    }
    return s.accessToken;
  }

  async login(email: string, password: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<AdminLoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }),
    );

    const stored: StoredSession = {
      accessToken: response.accessToken,
      expiresAtMs: Date.now() + response.expiresIn * 1000,
      email: response.email,
      displayName: response.displayName,
    };
    this.session.set(stored);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }

  logout(): void {
    this.session.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  private loadFromStorage(): StoredSession | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredSession;
      if (!parsed.expiresAtMs || parsed.expiresAtMs <= Date.now()) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}

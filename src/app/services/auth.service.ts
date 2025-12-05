import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'auth_token';

  async login(email: string, password: string): Promise<void> {
    // TODO: Reemplazar con llamada real a backend /api/auth/login
    if (email && password) {
      localStorage.setItem(this.tokenKey, 'FAKE_TOKEN');
      return;
    }
    throw new Error('Credenciales inválidas');
  }

  logout(){ if (typeof window !== 'undefined') localStorage.removeItem(this.tokenKey); }
  isLogged(): boolean { return typeof window !== 'undefined' && !!localStorage.getItem(this.tokenKey); }
  getToken(): string | null { return typeof window !== 'undefined' ? localStorage.getItem(this.tokenKey) : null; }
}

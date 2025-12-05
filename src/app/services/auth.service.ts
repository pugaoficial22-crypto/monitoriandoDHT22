import { Injectable } from '@angular/core';

interface DemoUser { username: string; password: string; role?: string }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'auth_token';
  private userKey = 'auth_user';

  // Demo users (frontend-only). Change passwords if desired.
  private USERS: DemoUser[] = [
    { username: 'admin', password: 'admin123', role: 'admin' },
    { username: 'user', password: 'user123', role: 'viewer' }
  ];

  async login(username: string, password: string): Promise<void> {
    // Frontend-only authentication for demo/assignment purposes.
    const match = this.USERS.find(u => u.username === username && u.password === password);
    if (match) {
      // store a simple token (not a real JWT) and the username
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.tokenKey, btoa(`${match.username}:${Date.now()}`));
        localStorage.setItem(this.userKey, JSON.stringify({ username: match.username, role: match.role }));
      }
      return;
    }
    throw new Error('Credenciales inválidas');
  }

  logout() { if (typeof window !== 'undefined') { localStorage.removeItem(this.tokenKey); localStorage.removeItem(this.userKey); } }

  isLogged(): boolean { return typeof window !== 'undefined' && !!localStorage.getItem(this.tokenKey); }

  getToken(): string | null { return typeof window !== 'undefined' ? localStorage.getItem(this.tokenKey) : null; }

  getCurrentUser(): { username: string; role?: string } | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(this.userKey);
    return raw ? JSON.parse(raw) : null;
  }
}

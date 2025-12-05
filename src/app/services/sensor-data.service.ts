import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

interface Reading { timestamp: string; temperature: number; humidity: number; }

@Injectable({ providedIn: 'root' })
export class SensorDataService {
  /**
   * Fetch history from backend. Falls back to mock data on error.
   */
  async getHistory(): Promise<Reading[]> {
    try {
      const res = await fetch(`${environment.apiBaseUrl}/telemetry`);
      if (!res.ok) throw new Error('bad response');
      const data = await res.json();
      // Normalize items (backend may return temp/hum or temperature/humidity)
      return (data || []).map((it: any) => ({
        timestamp: it.timestamp || it.createdAt || new Date().toISOString(),
        temperature: it.temp ?? it.temperature ?? 0,
        humidity: it.hum ?? it.humidity ?? 0
      }));
    } catch (e) {
      console.warn('Failed fetching history from backend, using mock', e);
      return this.mockHistory();
    }
  }
  private mockHistory(): Reading[] {
    const now = Date.now();
    return Array.from({ length: 20 }).map((_, i) => ({
      timestamp: new Date(now - (20 - i) * 5000).toISOString(),
      temperature: 24 + Math.random() * 2,
      humidity: 55 + Math.random() * 5
    }));
  }

  /**
   * Delete all telemetry in the backend. Requires confirm=true to avoid accidents.
   * Returns deletedCount on success.
   */
  async deleteAll(confirm: boolean = false): Promise<{ deletedCount: number }>{
    if (!confirm) throw new Error('deleteAll requires confirm=true');
    try {
      const res = await fetch(`${environment.apiBaseUrl}/telemetry?confirm=true`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      return await res.json();
    } catch (e) {
      console.warn('Failed deleting all telemetry', e);
      throw e;
    }
  }
}

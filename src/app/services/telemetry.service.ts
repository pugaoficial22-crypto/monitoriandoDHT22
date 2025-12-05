import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private listeners: ((reading: any) => void)[] = [];
  private interval?: any;
  private es?: EventSource | null = null;
  private ws?: WebSocket | null = null;

  constructor(private http: HttpClient) {}

  subscribeStreaming(cb: (reading: any) => void){
    this.listeners.push(cb);
    // Try WebSocket first (if configured), then SSE, then mock
    if (!this.ws && typeof WebSocket !== 'undefined' && (environment as any).wsUrl) {
      this.startWS();
    }
    if (!this.ws && !this.es && typeof EventSource !== 'undefined') {
      this.startSSE();
    }
    if (!this.ws && !this.es && !this.interval) this.startMock();
  }

  private startSSE(){
    try {
      this.es = new EventSource(`${environment.apiBaseUrl}/telemetry/stream`);
      this.es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          // Special event: clear history
          if (data && data.cleared) {
            this.listeners.forEach(l => l({ cleared: true }));
            return;
          }
          this.listeners.forEach(l => l({ timestamp: new Date(data.timestamp).toISOString(), temperature: data.temp ?? data.temperature, humidity: data.hum ?? data.humidity }));
        } catch (e) { console.warn('sse parse error', e); }
      };
      this.es.onerror = (err) => {
        console.warn('SSE error, closing and falling back to mock', err);
        this.stopSSE();
        if (!this.interval) this.startMock();
      };
    } catch (e) {
      console.warn('SSE start failed', e);
      this.es = null;
    }
  }

  private stopSSE(){
    try { this.es && this.es.close(); } catch (e) {}
    this.es = null;
  }

  private startWS(){
    const wsUrl = (environment as any).wsUrl;
    if (!wsUrl) return;
    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onmessage = (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data);
          if (data && data.cleared) {
            this.listeners.forEach(l => l({ cleared: true }));
            return;
          }
          this.listeners.forEach(l => l({ timestamp: new Date(data.timestamp).toISOString(), temperature: data.temp ?? data.temperature, humidity: data.hum ?? data.humidity }));
        } catch (e) { console.warn('ws parse error', e); }
      };
      this.ws.onopen = () => {
        // if WS opens, stop SSE/mock
        this.stopSSE();
        this.stopMock();
      };
      this.ws.onerror = (err) => {
        console.warn('WS error', err);
        try { this.ws && this.ws.close(); } catch (e) {}
        this.ws = null;
      };
      this.ws.onclose = () => { this.ws = null; };
    } catch (e) { console.warn('WS start failed', e); this.ws = null; }
  }

  private stopWS(){ try { this.ws && this.ws.close(); } catch(e){} this.ws = null; }

  /**
   * Try to notify the backend of a requested interval (seconds). Backend may not
   * support setting it — in that case we fallback to applying locally (mock).
   */
  async updateInterval(intervalMs: number): Promise<void> {
    this.stopMock();
    const seconds = Math.max(1, Math.round(intervalMs / 1000));
    // Try to POST the desired interval to the backend (optional, may 404)
    try {
      await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/update-interval`, { seconds }));
    } catch (e) {
      // ignore: backend currently returns random intervals; fallback to local behavior
      console.warn('Backend set-interval failed (expected on older API):', e);
    }
    // If SSE is active, server will push; otherwise start mock with requested interval
    if (!this.es) this.startMock(seconds * 1000);
  }

  /**
   * Request the backend's current interval (GET /api/update-interval returns plain text seconds).
   */
  async getUpdateInterval(): Promise<number> {
    try {
      const txt = await firstValueFrom(this.http.get(`${environment.apiBaseUrl}/update-interval`, { responseType: 'text' }));
      const n = parseInt((txt || '').toString(), 10);
      return isNaN(n) ? -1 : n;
    } catch (e) {
      console.warn('Failed fetching update interval from backend', e);
      return -1;
    }
  }

  private startMock(intervalMs: number = 5000) {
    this.interval = setInterval(() => {
      const reading = {
        timestamp: new Date().toISOString(),
        temperature: 24 + Math.random() * 2,
        humidity: 55 + Math.random() * 5
      };
      this.listeners.forEach(l => l(reading));
    }, intervalMs);
  }

  private stopMock(){ if (this.interval){ clearInterval(this.interval); this.interval = undefined; } }
}

import { Component, OnInit, AfterViewInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TelemetryService } from '../../services/telemetry.service';
import { SensorDataService } from '../../services/sensor-data.service';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  intervalSec = 10;
  intervalLoading = false;
  intervalMsg: string | null = null;

  loadingAll = false;
  loadingRecent = false;
  showAllMode = false; // when true, we display all history from backend
  refreshLoading = false;
  // pagination
  page = 1;
  pageSize = 10;

  private tempChart?: Chart;
  private humChart?: Chart;

  history = signal<any[]>([]);

  private streamingListener = (r: any) => this.onNewReading(r);

  constructor(private telemetry: TelemetryService, private sensor: SensorDataService, private auth: AuthService, private router: Router){
    console.log('[DashboardComponent] constructed');
  }

  ngOnInit(): void {
    this.loadRecentHistory();
    this.telemetry.subscribeStreaming(this.streamingListener);
  }

  ngAfterViewInit(): void {
    // charts will be created/updated after history is loaded
    setTimeout(() => this.renderCharts(), 0);
  }

  ngOnDestroy(): void {
    // TelemetryService doesn't currently support unsubscribe; left here for future cleanup
  }

  private async loadRecentHistory(){
    this.loadingRecent = true;
    try {
      const h = await this.sensor.getHistory();
      // Keep only the recent 40 by default
      const recent = h.slice(-40);
      this.history.set(recent);
      this.renderCharts();
    } catch (e) { console.error('failed load recent history', e); }
    finally { this.loadingRecent = false; }
  }

  // Load the full history from backend and switch to "all" mode
  async showAll(){
    this.loadingAll = true;
    try {
      const h = await this.sensor.getHistory();
      this.history.set(h);
      this.showAllMode = true;
      this.renderCharts();
    } catch (e) { console.error('failed load all history', e); }
    finally { this.loadingAll = false; }
  }

  // Switch back to recent mode and reload recent items
  async showRecent(){
    this.showAllMode = false;
    await this.loadRecentHistory();
  }

  // Force a refresh from backend while preserving current mode
  async refreshNow(){
    this.refreshLoading = true;
    try {
      const h = await this.sensor.getHistory();
      if (this.showAllMode) {
        this.history.set(h);
      } else {
        this.history.set(h.slice(-40));
      }
      this.renderCharts();
    } catch (e) {
      console.error('failed refresh', e);
    } finally {
      this.refreshLoading = false;
    }
  }

  // Pagination helpers
  get pageCount(){
    const total = this.history().length;
    return Math.max(1, Math.ceil(total / this.pageSize));
  }

  pageItems(){
    const all = this.history();
    const start = (this.page - 1) * this.pageSize;
    return all.slice(start, start + this.pageSize);
  }

  prevPage(){ if (this.page > 1) { this.page--; } }
  nextPage(){ if (this.page < this.pageCount) { this.page++; } }

  downloadCSV(){
    const rows = this.history().map(r => ({ time: r.timestamp, temp: r.temperature, hum: r.humidity }));
    const csv = [ ['time','temp','hum'].join(',') ].concat(rows.map(r => `${r.time},${r.temp},${r.hum}`)).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `telemetry_${new Date().toISOString()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  private onNewReading(reading: any){
    const arr = [...this.history()];
    arr.push(reading);
    // If we're in recent mode, keep buffer to last 40
    if (!this.showAllMode) {
      while (arr.length > 40) arr.shift();
    }
    this.history.set(arr);
    this.updateChartsWithReading(reading);
  }

  private renderCharts(){
    const hist = this.history();
    const labels = hist.map(h => new Date(h.timestamp).toLocaleTimeString());
    const temps = hist.map(h => h.temperature);
    const hums = hist.map(h => h.humidity);

    const tEl = document.getElementById('tempChart') as HTMLCanvasElement | null;
    const hEl = document.getElementById('humChart') as HTMLCanvasElement | null;
    if (tEl && !this.tempChart){
      const ctx = tEl.getContext('2d')!;
      this.tempChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Temperatura °C', data: temps, borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.15)', fill:true }] },
        options: { responsive: true, maintainAspectRatio: false }
      });
    } else if (this.tempChart){
      this.tempChart.data.labels = labels;
      (this.tempChart.data.datasets[0].data as any) = temps;
      this.tempChart.update();
    }

    if (hEl && !this.humChart){
      const ctx = hEl.getContext('2d')!;
      this.humChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Humedad %', data: hums, borderColor: '#4cc9f0', backgroundColor: 'rgba(76,201,240,0.12)', fill:true }] },
        options: { responsive: true, maintainAspectRatio: false }
      });
    } else if (this.humChart){
      this.humChart.data.labels = labels;
      (this.humChart.data.datasets[0].data as any) = hums;
      this.humChart.update();
    }
  }

  private updateChartsWithReading(reading: any){
    if (!reading) return;
    if (this.tempChart){
      const labels = this.tempChart.data.labels ? [...this.tempChart.data.labels as string[]] : [];
      labels.push(new Date(reading.timestamp).toLocaleTimeString());
      (this.tempChart.data.datasets[0].data as any).push(reading.temperature);
      while ((this.tempChart.data.labels as any).length > 40) { (this.tempChart.data.labels as any).shift(); (this.tempChart.data.datasets[0].data as any).shift(); }
      this.tempChart.update();
    }
    if (this.humChart){
      const labels = this.humChart.data.labels ? [...this.humChart.data.labels as string[]] : [];
      labels.push(new Date(reading.timestamp).toLocaleTimeString());
      (this.humChart.data.datasets[0].data as any).push(reading.humidity);
      while ((this.humChart.data.labels as any).length > 40) { (this.humChart.data.labels as any).shift(); (this.humChart.data.datasets[0].data as any).shift(); }
      this.humChart.update();
    }
  }

  async updateInterval(){
    this.intervalLoading = true; this.intervalMsg=null;
    try {
      await this.telemetry.updateInterval(this.intervalSec * 1000);
      this.intervalMsg = 'Intervalo actualizado';
    } catch { this.intervalMsg = 'Error al actualizar'; }
    finally { this.intervalLoading = false; setTimeout(()=> this.intervalMsg=null, 2500); }
  }

  // Delete all telemetry (asks for confirmation). Will clear UI on success.
  async deleteAllTelemetry(){
    if (!confirm('¿Borrar todos los datos de telemetría? Esta acción no se puede deshacer.')) return;
    try {
      // Use sensor service to delete
      const r = await this.sensor.deleteAll(true);
      console.log('deleted', r);
      // Clear local UI state and charts
      this.history.set([]);
      this.renderCharts();
      alert(`Se eliminaron ${r.deletedCount || 0} registros`);
    } catch (e: any) {
      console.error('delete failed', e);
      const msg = e && e.message ? e.message : String(e);
      alert('No se pudo eliminar los datos: ' + msg);
    }
  }

  logout(){
    this.auth.logout();
    this.router.navigateByUrl('/');
  }
}

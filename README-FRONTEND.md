# Frontend Angular 19 - Telemetría DHT22

Este proyecto es un frontend móvil minimalista para visualizar datos de un sensor DHT22 conectado a un ESP32 y almacenados en una API (Render + MongoDB). Incluye:

- Login simple (placeholder, listo para conectar a backend real)
- Dashboard con gráficas de temperatura y humedad (Chart.js)
- Historial reciente de lecturas
- Botón para cambiar intervalo de telemetría
- Tema en colores azules, verdes y morados

## Requisitos
- Node.js 18+
- npm 9+

## Instalación
```bash
cd frontend
npm install
```

## Desarrollo
```bash
npm start
```
Abre: http://localhost:4200

## Build producción
```bash
npm run build
```
Salida: `dist/frontend`

## Conexión al Backend
Edita `src/environments/environment.ts` y ajusta `apiBaseUrl`:
```ts
export const environment = {
  production: false,
  apiBaseUrl: 'https://TU_BACKEND.onrender.com/api'
};
```
Endpoints esperados (ajusta según tu backend real):
- `GET /telemetry/history` -> Lista de lecturas { timestamp, temperature, humidity }
- `GET /telemetry/latest` -> Última lectura
- `POST /telemetry/interval` body { intervalMs }
- `POST /auth/login` body { email, password } -> token

## Adaptar servicios a backend real
En `sensor-data.service.ts` reemplaza `mockHistory()` por fetch real:
```ts
const res = await fetch(`${environment.apiBaseUrl}/telemetry/history`);
return res.json();
```
En `telemetry.service.ts` reemplaza `startMock()` por websocket o SSE si tu backend lo soporta.

En `auth.service.ts` cambia `login()`:
```ts
const res = await fetch(`${environment.apiBaseUrl}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
if(!res.ok) throw new Error('Credenciales inválidas');
const { token } = await res.json();
localStorage.setItem(this.tokenKey, token);
```

## Despliegue en Render / Vercel / Netlify
1. Ejecuta build.
2. Sube carpeta `dist/frontend` (en Vercel puedes apuntar a proyecto y usar build automático).
3. Asegura que las variables de entorno del backend estén configuradas para recibir intervalos.

## Mejoras futuras
- Reemplazar mocks por WebSocket/SSE
- Manejo de token JWT y refresh
- Gráficas combinadas y alertas de umbral
- PWA + modo offline

## Licencia
Uso académico.

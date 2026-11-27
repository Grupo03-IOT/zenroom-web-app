# SenseWork Web

Aplicación React + TypeScript basada en los diseños web de [Figma](https://www.figma.com/design/xYSodRNszkA9kbobfyR6X2/SenseWork-%C2%B7-Applications-UX-UI-Design--TB1-?node-id=1-4&m=dev). Incluye pantallas de administrador y miembro, diseño adaptable y recursos SVG descargados del archivo de Figma.

**Aplicación publicada:** https://zenroom-web-app.vercel.app (Vercel despliega la rama `main`).

## Ejecutar en local (Run locally)

Requisitos: Node.js 20 o superior y npm.

```bash
npm ci                 # instala las dependencias exactas de package-lock.json
cp .env.example .env.local
npm run dev            # http://127.0.0.1:5173, con /cloud dirigido a Cloud API en Azure
```

| Comando | Uso |
| --- | --- |
| `npm run dev` | Desarrollo contra Cloud API desplegado en Azure. |
| `npm run dev:local` | Desarrollo contra un Cloud API local en `http://127.0.0.1:8080` (las tres aplicaciones en la laptop). |
| `npx tsc -b` | Comprobación de tipos. |
| `npm run build` | Comprobación de tipos y versión de producción en `dist/`. |
| `npm run preview` | Sirve `dist/` con el mismo proxy `/cloud`. |
| `npm run check:api` | Comprueba contratos y consultas reales de Cloud sin modificar datos (ver más abajo). |

## Variables de entorno (Environment variables)

| Variable | Dónde se lee | Valor por defecto | Uso |
| --- | --- | --- | --- |
| `VITE_CLOUD_API_URL` | Navegador (`src/shared/api/http.ts`) | `/cloud` | Base de Cloud API. Con `/cloud` las peticiones pasan por el proxy de Vite o de Vercel. Una URL absoluta exige que Cloud permita el origen de la web (CORS). |
| `CLOUD_PROXY_TARGET` | `vite.config.ts` (solo `dev` y `preview`) | URL de Cloud API en Azure | Cambia el destino del proxy `/cloud` sin tocar el código. `npm run dev:local` usa siempre `http://127.0.0.1:8080`. |
| `ZENROOM_CHECK_URL` | `scripts/check-api.mjs` | `http://127.0.0.1:5173/cloud` | URL que consulta la comprobación de contratos. |
| `ZENROOM_CHECK_EMAIL`, `ZENROOM_CHECK_PASSWORD` | `scripts/check-api.mjs` | — | Cuenta para las consultas autenticadas de la comprobación. Se definen en el terminal, nunca en archivos versionados. |

Copia `.env.example` a `.env.local` (fuera de Git) y reinicia `npm run dev` después de cambiar una variable. Solo las variables con prefijo `VITE_` llegan al navegador; no pongas secretos en ellas. En Vercel el proxy está definido en `vercel.json`, así que la aplicación publicada no necesita variables.

## Direcciones de las páginas

Cada pantalla tiene una URL propia. Por ejemplo, **Insights** se abre en `http://127.0.0.1:5173/insights`, **salas** en `/rooms`, **alertas** en `/alerts` e **inicio de sesión** en `/login`. El detalle de una sala usa `/rooms/{id}` para administradores o `/member-rooms/{id}` para miembros. Se pueden guardar y compartir estas direcciones; si falta iniciar sesión, la aplicación vuelve a la página solicitada después de acceder. Los botones Atrás y Adelante del navegador también funcionan.

Al publicar la aplicación, el servidor debe devolver `index.html` para las rutas de React como `/insights`; Vite ya lo hace durante el desarrollo.

## Idioma

El selector **ES / EN** está en la pantalla de acceso y en la barra superior de la aplicación. El español se muestra al abrirla por primera vez; la selección queda guardada en este navegador para las siguientes visitas.

## Conexión con Cloud API

La aplicación consulta exclusivamente los datos de Cloud API desplegado en Azure. Para configurar esta instalación, copia `.env.example` a `.env.local` y conserva:

```env
VITE_CLOUD_API_URL=/cloud
```


Durante desarrollo y `npm run preview`, Vite reenvía `/cloud` al backend desplegado. `vercel.json` define el mismo proxy para producción antes de la ruta de React. Así, las peticiones permanecen en el origen de la web aunque el backend no publique permisos CORS para localhost. En otro hosting, configura un proxy equivalente para `/cloud`; una URL absoluta en `VITE_CLOUD_API_URL` requiere que Cloud permita el origen de la web.


`.env.local` permanece fuera de Git. Reinicia `npm run dev` después de cambiar variables de entorno. El destino del proxy está configurado en `vite.config.ts` para desarrollo y preview, y en `vercel.json` para producción.

El token de usuario se guarda en `sessionStorage` y se envía como `Authorization: Bearer`. Salir, recibir un 401 o alcanzar su vencimiento termina la sesión. El cliente HTTP convierte las claves JSON entre `snake_case` y `camelCase`, limita la espera de las peticiones y admite respuestas vacías 204.

## Flujo de sensores

El ESP32 puede conservar el programa que imprime sus sensores por USB.
En Edge ejecuta `python tools/serial_bridge.py --list-ports` y luego
`python tools/serial_bridge.py --port COM5` con su puerto real. El detalle de
cada sala muestra movimiento, distancia, potenciometro ADC y tres botones,
ademas de temperatura y humedad. Edge publica minutos cerrados: la primera
actualizacion puede tardar hasta dos minutos. Si no hay microfono, la tarjeta de
Ruido muestra el potenciometro en ADC (0–4095), tambien
en el grafico. Las metricas acusticas y sus umbrales siguen reservados para dBA
medidos; el CSV incluye el ADC en una columna separada.

La guia completa esta en `edge-api/docs/usb-local.md`. Las pulsaciones que no
coincidan con una impresion de tu programa (cada 2 s) no pueden observarse en
la web; el puente solo recibe lo que realmente imprime el dispositivo.

**ESP32 → Edge API → Cloud API → aplicación web**. El navegador consulta solamente Cloud API. Las salas aparecen cuando Edge envía sus primeras lecturas y los gateways cuando envía sus primeros latidos.

En el proceso Edge configura `CLOUD_URL` con la URL de Azure terminada en `/api/v1/readings`, `HEARTBEAT_URL` con `/api/v1/edges/heartbeat`, `SITE_CODE` con un código de local existente y `CLOUD_API_KEY` con una credencial emitida por Cloud. Las credenciales nuevas de la web incluyen `readings:write`, `thresholds:read`, `edges:heartbeat` y `alerts:write` (este último permite al Edge subir las alertas que abre y cierra). Las credenciales antiguas conservan los permisos con los que se emitieron: para que un Edge suba alertas hay que crear una clave nueva, y la pantalla de credenciales lo indica.

Las pantallas filtran salas y dispositivos por local, muestran el tipo de sala devuelto por Cloud y consultan los umbrales configurados. El estado visual compara la última lectura con esos umbrales; no equivale a una alerta sostenida. Una lectura con más de cinco minutos no se presenta como confort u ocupación actuales. Su fecha y la última hora registrada siguen disponibles para consultar el historial.

La analítica consulta `period=AAAA-MM` y abre inicialmente el mes de la última lectura. Usa los límites y la zona horaria que devuelve Cloud, respeta los resultados sin evidencia concluyente y calcula el promedio diario del ruido por energía y duración.

## Funciones conectadas

| Interacción | Cloud API |
| --- | --- |
| Iniciar sesión / registrar miembro | `POST /api/v1/auth/login`, `POST /api/v1/users` |
| Consultar cuentas | `GET /api/v1/users` |
| Listar y crear locales | `GET/POST /api/v1/sites` |
| Listar y crear tipos de sala | `GET/POST /api/v1/sites/{siteId}/room-types` |
| Consultar y clasificar salas | `GET /api/v1/rooms`, `PATCH /api/v1/rooms/{roomId}` |
| Historial y exportación CSV | `GET /api/v1/rooms/{roomId}/readings?from=...&to=...` |
| Consultar y guardar umbrales | `GET /api/v1/room-types/{roomTypeId}/thresholds`, `PUT .../{metric}` |
| Analítica por período y exportación CSV | `GET /api/v1/insights/rooms/{roomId}?period=AAAA-MM` |
| Dispositivos y diagnóstico del Edge | `GET /api/v1/devices`, `GET /api/v1/edges` |
| Crear, listar y revocar credenciales | `POST/GET /api/v1/credentials`, `DELETE /api/v1/credentials/{credentialId}` |
| Alertas: lista con filtros y contador del encabezado | `GET /api/v1/alerts?status=OPEN\|ACKNOWLEDGED\|CLOSED&room_id=&from=&to=&has_action=true` |
| Reconocer una alerta con su acción correctiva (3 a 500 caracteres) | `PATCH /api/v1/alerts/{id}/acknowledge` |
| Enviar un reporte de incomodidad (miembro) | `POST /api/v1/discomfort-reports` |
| Mis reportes (miembro) | `GET /api/v1/discomfort-reports/mine` |
| Reportes del local y resumen por sala (administrador) | `GET /api/v1/discomfort-reports?room_id=&category=&from=&to=`, `GET /api/v1/discomfort-reports/summary?from=&to=` |

Las operaciones de administración requieren rol `ADMIN`; las cuentas nuevas se crean como `MEMBER`. Cloud todavía no expone invitaciones, cambios de rol ni órdenes al indicador de puerta. Esas acciones permanecen deshabilitadas en la aplicación. Las pantallas legales requieren el texto aprobado del equipo antes de publicarse.

## Organización del código

| Archivo o carpeta | Responsabilidad |
| --- | --- |
| `src/app/App.tsx` | Sesión, navegación, actualización de datos y filtros por local. |
| `src/app/screens` | Formularios y presentación de los datos de Cloud API. |
| `src/contexts/identity` | Inicio de sesión, cuentas y credenciales de máquinas. |
| `src/contexts/monitoring` | Modelos y consultas de salas, dispositivos, gateways, lecturas y reportes de incomodidad. |
| `src/contexts/alerting` | Umbrales, alertas (estados `OPEN`, `ACKNOWLEDGED`, `CLOSED`) y su reconocimiento. |
| `src/contexts/insights` | Contrato de analítica, agregación diaria de lecturas y textos de cada hallazgo y veredicto. |
| `src/app/hooks/useLoad.ts` | Carga con estados de carga, error y reintento, y recarga periódica. |
| `src/shared/api/http.ts` | Transporte HTTP, autenticación, conversión de JSON y errores. |
| `src/shared/i18n` | Traducciones de la interfaz. |
| `vite.config.ts` / `vercel.json` | Proxy a Cloud en desarrollo, preview y Vercel. |
| `scripts/check-api.mjs` | Comprobación de contratos y consultas reales sin modificar datos. |

## Validación de la conexión

Con `npm run dev` en marcha, ejecuta `npm run check:api`. Comprueba salud, proxy, rutas OpenAPI y protección de endpoints. Para incluir acceso y lecturas autenticadas, define `ZENROOM_CHECK_EMAIL` y `ZENROOM_CHECK_PASSWORD` en el entorno del terminal, sin guardarlos en archivos versionados. `ZENROOM_CHECK_URL` permite cambiar la URL de comprobación, por defecto `http://127.0.0.1:5173/cloud`.

La validación consulta locales, salas, tipos, umbrales, historial y analítica. Con una cuenta administradora también consulta dispositivos, gateways, cuentas y credenciales. Las operaciones de escritura se contrastan con OpenAPI, sin crear ni revocar recursos durante esta comprobación.

Para comprobar TypeScript y generar producción: `npm run build`.

## Repositorios de referencia

- [Cloud API](https://github.com/Grupo03-IOT/cloud-api)
- [Edge API](https://github.com/Grupo03-IOT/edge-api)

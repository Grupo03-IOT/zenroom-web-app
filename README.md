# SenseWork Web

Aplicación React + TypeScript basada en los diseños web de [Figma](https://www.figma.com/design/xYSodRNszkA9kbobfyR6X2/SenseWork-%C2%B7-Applications-UX-UI-Design--TB1-?node-id=1-4&m=dev). Incluye pantallas de administrador y miembro, diseño adaptable y recursos SVG descargados del archivo de Figma.

## Abrir en WebStorm

1. En WebStorm, usa **File → Open** y selecciona esta carpeta `frontend-web`.
2. Usa Node.js 20 o superior.
3. En el terminal de WebStorm ejecuta:

   ```bash
   npm install
   npm run dev
   ```

4. Abre la dirección que imprima Vite, normalmente `http://localhost:5173`.

Para verificar la versión de producción: `npm run build`.

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

**ESP32 → Edge API → Cloud API → aplicación web**. El navegador consulta solamente Cloud API. Las salas aparecen cuando Edge envía sus primeras lecturas y los gateways cuando envía sus primeros latidos.

En el proceso Edge configura `CLOUD_URL` con la URL de Azure terminada en `/api/v1/readings`, `HEARTBEAT_URL` con `/api/v1/edges/heartbeat`, `SITE_CODE` con un código de local existente y `CLOUD_API_KEY` con una credencial emitida por Cloud. Las credenciales nuevas de la web incluyen `readings:write`, `thresholds:read` y `edges:heartbeat`. Las credenciales antiguas conservan los permisos con los que se emitieron.

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

Las operaciones de administración requieren rol `ADMIN`; las cuentas nuevas se crean como `MEMBER`. Cloud todavía no expone invitaciones, cambios de rol o activación de cuentas, reportes de incomodidad, gestión de alertas locales ni órdenes al indicador de puerta. Esas acciones permanecen deshabilitadas en la aplicación. Las pantallas legales requieren el texto aprobado del equipo antes de publicarse.

## Organización del código

| Archivo o carpeta | Responsabilidad |
| --- | --- |
| `src/app/App.tsx` | Sesión, navegación, actualización de datos y filtros por local. |
| `src/app/screens` | Formularios y presentación de los datos de Cloud API. |
| `src/contexts/identity` | Inicio de sesión, cuentas y credenciales de máquinas. |
| `src/contexts/monitoring` | Modelos y consultas de salas, dispositivos, gateways y lecturas. |
| `src/contexts/alerting` | Consulta y configuración de umbrales de Cloud. |
| `src/contexts/insights` | Contrato de analítica y agregación diaria de lecturas. |
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

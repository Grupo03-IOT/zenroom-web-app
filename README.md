# SenseWork Web

Aplicación React + TypeScript basada en los mockups web de [Figma](https://www.figma.com/design/xYSodRNszkA9kbobfyR6X2/SenseWork-%C2%B7-Applications-UX-UI-Design--TB1-?node-id=1-4&m=dev). Incluye pantallas de administrador y miembro, diseño adaptable y recursos SVG descargados del archivo de Figma.

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

## Modo demo y conexión real

El proyecto inicia en **modo demo** para poder recorrer el diseño sin hardware ni servidores. El aviso visible en pantalla identifica esos datos de ejemplo. Se puede elegir el rol administrador o miembro en el inicio de sesión de demo.

Para usar las APIs, copia `.env.example` a `.env.local` y cambia:

```env
VITE_DEMO_MODE=false
VITE_CLOUD_API_URL=/cloud
```

En WebStorm, `.env.local` se crea dentro de la carpeta `frontend-web`, al lado de `package.json`. Después de cambiarlo, reinicia `npm run dev` y vuelve a cargar la página. Si Cloud API no está en marcha, el inicio de sesión real no funcionará; para explorar las pantallas sin servidores, conserva `VITE_DEMO_MODE=true`.

Durante el desarrollo, Vite reenvía `/cloud` a `http://127.0.0.1:8080`. En producción, configura esa ruta en un proxy del mismo origen o define una URL de Cloud API accesible desde el navegador. La aplicación web solo consulta **Cloud API**. Inicia Cloud API y crea un local antes de enviar lecturas.

El flujo de sensores es **ESP32 → Edge API → Cloud API → aplicación web**. Edge API recibe lotes del dispositivo, calcula agregados por minuto y alertas locales, y reintenta la subida a Cloud API si se cae la conexión. Edge usa su propia configuración `CLOUD_URL` (por defecto `http://127.0.0.1:8080/api/v1/readings`) y `CLOUD_TOKEN` para autenticarse ante Cloud. Esa configuración va en el proceso Edge, no en el navegador. El repositorio Edge documenta un simulador para producir lecturas sin hardware.

El token de usuario se guarda en `sessionStorage`, se envía como `Authorization: Bearer` a Cloud API y se elimina al salir o al expirar. La capa HTTP convierte automáticamente los nombres JSON `snake_case` de Cloud API a los modelos `camelCase` de React, y a la inversa en las solicitudes.

## Organización DDD del frontend

- `src/contexts/identity`: sesión y autenticación.
- `src/contexts/monitoring`: locales, tipos de sala, salas y lecturas.
- `src/contexts/alerting`: umbrales del Cloud y modelos de alerta para la vista demo; las alertas reales esperan endpoints de Cloud.
- `src/contexts/insights`: analítica de salas.
- `src/shared`: transporte HTTP, datos de demostración y recursos visuales.
- `src/app`: composición, navegación y pantallas.

Los modelos de dominio no hacen peticiones HTTP; cada contexto concentra sus adaptadores en `infrastructure`.

## Funciones conectadas

| Interacción | API verificada |
| --- | --- |
| Iniciar sesión | Cloud `POST /api/v1/auth/login` |
| Registrar cuenta de miembro | Cloud `POST /api/v1/users` |
| Listar y crear locales | Cloud `GET/POST /api/v1/sites` |
| Listar y crear tipos de sala | Cloud `GET/POST /api/v1/sites/{siteId}/room-types` |
| Listar salas y clasificarlas | Cloud `GET /api/v1/rooms`, `PATCH /api/v1/rooms/{roomId}` |
| Consultar historial de sala y exportar CSV | Cloud `GET /api/v1/rooms/{roomId}/readings` |
| Consultar y guardar umbrales | Cloud `GET/PUT /api/v1/room-types/{roomTypeId}/thresholds` |
| Consultar analítica y exportar CSV | Cloud `GET /api/v1/insights/rooms/{roomId}` |
| Crear credencial de Edge y copiarla | Cloud `POST /api/v1/credentials` |

El navegador no consume endpoints de Edge API. Los datos de alertas, dispositivos y diagnóstico que se ven en **modo demo** son ejemplos locales.

## Límites de las APIs actuales

Los mockups incluyen funciones que todavía no tienen endpoint en Cloud API: invitar, listar o desactivar miembros; enviar reportes de incomodidad; listar, confirmar o cerrar alertas; consultar dispositivos y diagnóstico del Edge; registrar o identificar dispositivos manualmente; mandar órdenes al indicador de puerta; listar o revocar credenciales. La interfaz muestra estas limitaciones y no simula éxito en modo real. En demo, las altas manuales de salas, la gestión de miembros y credenciales, los reportes de incomodidad y la confirmación de alertas solo cambian el estado local; no envían correos ni modifican servidores.

Cloud API registra cuentas nuevas con rol **MEMBER**; el diseño de alta de administrador requiere un flujo de asignación de rol del backend. Además, `RoomResource` no incluye el identificador de local ni el tipo de sala: el selector de local sí determina los tipos y umbrales configurables, pero la API actual no permite filtrar el directorio de salas por local ni mostrar con certeza el tipo de una sala después de recargar. El estado de confort que se muestra en la lista es una aproximación visual basada en lecturas y valores de ejemplo; para igualar la evaluación real se necesita publicar el estado calculado o la relación sala–tipo en la API.

En registro, el interruptor **Administro un coworking** crea una sesión de administrador solo en modo demo. Con Cloud API real, esa opción explica que el alta de administrador aún no está disponible y desactiva el envío; el registro de miembro sigue usando `POST /api/v1/users`.

Las pantallas legales son marcadores claros hasta que el equipo proporcione el texto aprobado de términos y privacidad.

## Repositorios de referencia

- [Cloud API](https://github.com/Grupo03-IOT/cloud-api)
- [Edge API](https://github.com/Grupo03-IOT/edge-api)

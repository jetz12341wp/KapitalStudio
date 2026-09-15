# Kápital Studio — sitio + reservas (Cloudflare Pages)

Sitio web y sistema de reservas propio de Kápital Studio (Av. Las Palmeras #5194, Los Olivos), desplegado en **Cloudflare Pages**.

- `public/` — front-end estático (HTML + Tailwind CDN, sin build). Cloudflare lo sirve directo.
- `functions/` — backend como **Cloudflare Pages Functions** (runtime de Workers): cada archivo bajo `functions/api/` es una ruta de API.
- `migrations/` — esquema SQL para la base de datos **Cloudflare D1** (SQLite serverless) donde se guardan servicios y citas.

No hay servidor Node tradicional: todo corre en el runtime de Cloudflare (front + API), en el mismo dominio.

## Cómo está armado

```
public/            → se publica tal cual (Build output directory = public)
functions/api/services.js               → GET  /api/services
functions/api/availability.js           → GET  /api/availability
functions/api/appointments.js           → GET  /api/appointments (admin) · POST /api/appointments
functions/api/admin/services.js         → GET  /api/admin/services (admin) · POST (admin)
functions/api/admin/services/[id].js    → PUT / DELETE /api/admin/services/:id (admin)
functions/_lib/                         → código compartido (no son rutas; el "_" al inicio hace que Cloudflare las ignore como ruta)
```

## 0. Si el deploy falla con "Workers-specific command in a Pages project"

Este error **no se arregla desde el código del repositorio** — es una configuración del proyecto en el dashboard de Cloudflare. Pasa cuando el **"Deploy command"** del proyecto está puesto como `npx wrangler deploy` (el comando de un Worker) en vez de `npx wrangler pages deploy public` (el de Pages).

Corrígelo así:

1. Dashboard de Cloudflare → **Workers & Pages** → tu proyecto → **Settings** → busca la sección de build (puede llamarse **"Builds"**, **"Build configuration"** o similar).
2. Busca el campo **"Deploy command"** (o "Comando de deploy"). Si dice `npx wrangler deploy` (o `wrangler deploy`), cámbialo por:
   ```
   npx wrangler pages deploy public
   ```
3. Verifica también el **"Build command"** — para este proyecto puede quedar vacío (no hay paso de compilación; `public/` ya está listo tal cual).
4. Guarda y vuelve a desplegar (un nuevo commit, o "Retry deployment" desde el dashboard).

Si no encuentras esos campos o el proyecto no te deja editarlos, es probable que se haya creado como tipo **"Worker"** en vez de **"Pages"** en el flujo unificado de Cloudflare — en ese caso lo más simple es crear un proyecto nuevo desde **Workers & Pages → Create → Pages → Connect to Git**, eligiendo este mismo repositorio, y usar ese proyecto nuevo en vez del actual (con Build output directory = `public`, sin Deploy command).

`wrangler.toml` **sí está incluido en este repositorio** (no lo borres): tiene `pages_build_output_dir = "public"`, que es lo que le dice a Wrangler que esto es un proyecto Pages y no un Worker. Sin ese archivo, el error es todavía más probable.

## 1. Base de datos D1

Ya tienes una base D1 creada. Falta:

1. **Enlazarla al proyecto Pages**: en el dashboard de Cloudflare → tu proyecto Pages → **Settings → Functions → D1 database bindings** → agrega un binding con:
   - Variable name: **`DB`** (exactamente así, en mayúsculas; el código lo espera con ese nombre)
   - D1 database: tu base existente
2. **Aplicar el esquema** (crea las tablas y siembra los 7 servicios reales). La forma más simple, sin instalar nada: dashboard de Cloudflare → **D1** → tu base → pestaña **Console** → pega y corre el contenido de `migrations/0001_init.sql`, luego el de `migrations/0002_seed_services.sql`.

   Si prefieres la línea de comandos:
   ```bash
   npm install
   npx wrangler login
   npx wrangler d1 execute TU-BASE-D1 --remote --file=./migrations/0001_init.sql
   npx wrangler d1 execute TU-BASE-D1 --remote --file=./migrations/0002_seed_services.sql
   ```
   Reemplaza `TU-BASE-D1` por el nombre real de tu base (lo ves en el dashboard o con `npx wrangler d1 list`).
3. Los scripts `npm run d1:migrate:remote` / `npm run d1:migrate:local` en `package.json` hacen lo mismo, pero tienen hardcodeado el nombre `kapital-studio-db` — edítalos con el nombre real de tu base antes de usarlos.

## 2. Variables de entorno del proyecto Pages

En el dashboard → tu proyecto Pages → **Settings → Environment variables**, agrega (como variable normal o "Secret" para las sensibles):

| Variable | Obligatoria | Descripción |
|---|---|---|
| `ADMIN_TOKEN` | Sí | Token para entrar a `/admin.html` y usar los endpoints `/api/admin/*`. Genera uno propio, ej. `openssl rand -hex 24`. **Como Secret.** |
| `BUSINESS_TIMEZONE` | No | Por defecto `America/Lima`. |
| `BUSINESS_TIMEZONE_OFFSET` | No | Por defecto `-05:00` (Perú no tiene horario de verano). |
| `GOOGLE_CALENDAR_ID` | Solo si quieres sync a Calendar | ID del calendario donde se crean las citas. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Solo si quieres sync a Calendar | Contenido completo del JSON del service account, en una sola línea. **Como Secret.** |

Sin `GOOGLE_CALENDAR_ID`/`GOOGLE_SERVICE_ACCOUNT_JSON`, las reservas igual se guardan en D1; solo no se crea el evento en Calendar (`calendarSynced: false` en la respuesta).

Después de agregar o cambiar variables, Cloudflare pide re-desplegar (un nuevo commit, o "Retry deployment" desde el dashboard) para que las tome.

## 3. Configurar la sincronización con Google Calendar

Se usa un **Service Account** de Google Cloud (server-to-server, sin que nadie tenga que iniciar sesión).

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) y crea (o reutiliza) un proyecto.
2. Habilita la **Google Calendar API**.
3. Crea una **cuenta de servicio** → "Claves" → "Agregar clave" → JSON. Descarga el archivo y **no lo subas al repositorio**.
4. Copia el email de la cuenta de servicio (`algo@proyecto.iam.gserviceaccount.com`).
5. En [Google Calendar](https://calendar.google.com/), abre el calendario que vas a usar → "Configuración y uso compartido" → "Compartir con determinadas personas" → agrega el email del service account con permiso **"Realizar cambios en los eventos"**.
6. Copia el **ID de calendario** ("Integrar el calendario" → "ID de calendario").
7. Pega ese ID en `GOOGLE_CALENDAR_ID`, y el contenido del JSON descargado (una sola línea) en `GOOGLE_SERVICE_ACCOUNT_JSON`, como variables/secrets del proyecto Pages (paso 2).
8. Re-despliega. Al reservar, la respuesta debe traer `calendarSynced: true` y el evento debe aparecer en el calendario.

## 4. Administrar los servicios (sin tocar código)

Los servicios que aparecen en el formulario **no están escritos en el código**: viven en D1 y se administran desde `https://tu-sitio.pages.dev/admin.html` (o tu dominio propio si lo conectaste).

1. Abre `/admin.html` e ingresa el `ADMIN_TOKEN` que pusiste en el paso 2.
2. Ahí puedes **agregar** servicios (nombre, descripción, duración, precio), **desactivar** los que ya no ofreces y **eliminar** los que nunca tuvieron citas (si tienen citas asociadas, se desactivan en vez de borrarse, para no romper el historial).
3. El sitio público (sección "Servicios", el carrusel y el selector del formulario de reserva) se actualiza solo, leyendo siempre `/api/services`.

La migración `0002_seed_services.sql` ya sembró los 7 servicios reales de Kápital Studio: Corte clásico (S/25), Corte degradado (S/30), Corte a tijera (S/30), Perfilado de barba (S/15), Limpieza facial (S/50), Ondulación (S/100) y Tinte (desde S/150). Las **duraciones** son una estimación razonable (no se especificaron) — ajústalas desde `/admin.html` si no coinciden con las reales.

`/admin.html` no está enlazada desde el sitio ni aparece en el sitemap (lleva `noindex`), pero no depende de eso para estar segura: cada acción pasa por los endpoints `/api/admin/*`, protegidos por `ADMIN_TOKEN`.

## Desarrollo local

Sin tocar nada más, `npm run dev` levanta el sitio pero las rutas `/api/*` fallan (no hay ninguna base D1 enlazada — es el comportamiento esperado sin configurar nada). Para tener D1 funcionando en local:

1. Descomenta el bloque `[[d1_databases]]` al final de `wrangler.toml` y pon el nombre y `database_id` de tu base real (los ves en el dashboard o con `npx wrangler d1 list`; para solo probar en local, cualquier texto sirve como `database_id`, no hace falta que sea el real). No son datos sensibles — está bien dejarlos en el repo.
2. Carga el esquema y los servicios de ejemplo a la base **local** (un SQLite separado en `.wrangler/`, no toca tu base de producción):
   ```bash
   npm install
   npx wrangler d1 execute TU-BASE-D1 --local --file=./migrations/0001_init.sql
   npx wrangler d1 execute TU-BASE-D1 --local --file=./migrations/0002_seed_services.sql
   ```
3. Levanta el sitio:
   ```bash
   npm run dev
   ```
   Abre `http://localhost:8788` — ahora `/api/*` sí responde, usando la misma base local que acabas de migrar (Wrangler la resuelve por el bloque `[[d1_databases]]` de `wrangler.toml`, así que migraciones y `dev` comparten los mismos datos).

## API

- `GET /api/services` — servicios **activos** (id, nombre, descripción, duración en minutos, precio, si es "desde"). La consume el formulario público.
- `GET /api/availability?date=YYYY-MM-DD&service=<id>` — horarios libres ese día para ese servicio.
- `POST /api/appointments` — crea una reserva. Body JSON: `{ service, date, time, name, phone, email?, notes? }`.
- `GET /api/appointments` — próximas citas (admin, header `x-admin-token`).
- `GET /api/admin/services` — todos los servicios, activos e inactivos (admin).
- `POST /api/admin/services` — crea un servicio. Body JSON: `{ name, description?, duration, price?, priceIsFrom? }` (admin).
- `PUT /api/admin/services/:id` — actualiza nombre, descripción, duración, precio o estado activo (admin).
- `DELETE /api/admin/services/:id` — elimina el servicio, o lo desactiva si ya tiene citas asociadas (admin).

## Horario de atención (usado para calcular disponibilidad)

- Todos los días: 10:00 a. m. – 9:00 p. m.

Se puede ajustar en `functions/_lib/config.js` (`BUSINESS_HOURS`). La duración y el precio de cada servicio se administran desde `/admin.html`.

## Logo

El header y el hero de `public/index.html` recrean el logo de Kápital Studio (arco, wordmark "KÁPITAL", "STUDIO" con estrellas) con CSS y la fuente Anton, no con el archivo de imagen original: no fue posible extraer el PNG compartido como referencia en el entorno donde se generó este sitio. Si tienes el archivo original (PNG/SVG), puedes reemplazar ese bloque por una etiqueta `<img>` apuntando a `public/logo.png`.

## Pendiente antes de publicar

- Enlazar la base D1 al proyecto Pages y aplicar las migraciones (paso 1 arriba) — sin esto, el sitio carga pero ningún servicio ni reserva funciona.
- Configurar `ADMIN_TOKEN` como variable de entorno del proyecto (paso 2) — sin esto, `/admin.html` nunca podrá entrar.
- Dominio propio (hoy el `<link rel="canonical">` de `public/index.html` y el correo de `libro-de-reclamaciones.html` usan `TU-DOMINIO-AQUI.pe` como placeholder).
- Logo real como archivo de imagen (ver sección "Logo" arriba), si no quieres quedarte con la recreación tipográfica.
- RUC / razón social en el footer.
- Redes sociales reales del negocio (hoy no hay ninguna enlazada).
- Fotos reales del local y el equipo.

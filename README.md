# Barbería Skills — sitio + reservas

Sitio web y sistema de reservas propio de Barbería Skills (San Juan de Lurigancho).

- `public/` — front-end estático (HTML + Tailwind CDN, sin build).
- `server/` — backend Node.js + Express + SQLite que atiende la reserva y crea el evento en Google Calendar.

El backend sirve también los archivos de `public/`, así que en producción corre un solo proceso.

## Requisitos

- Node.js 18 o superior.

## Instalación y arranque local

```bash
cd server
cp .env.example .env   # completa las variables (ver abajo)
npm install
npm start
```

Abre `http://localhost:3000` — verás el sitio y el formulario de reserva funcionando contra el backend local (con SQLite en `server/data/appointments.sqlite`).

Sin configurar Google Calendar, las reservas igual se guardan en la base de datos; solo no se crea el evento (`calendarSynced: false` en la respuesta).

## Administrar los servicios (sin tocar código)

Los servicios que aparecen en el formulario de reserva **no están escritos en el código**: viven en la base de datos y se administran desde `http://localhost:3000/admin.html` (o `https://tu-dominio/admin.html` una vez desplegado).

1. Abre `/admin.html` e ingresa el valor de `ADMIN_TOKEN` que pusiste en `server/.env`.
2. Ahí puedes **agregar** tus servicios reales (nombre, descripción y duración en minutos), **desactivar** los que ya no ofreces (dejan de verse en la web, pero no se borran citas pasadas que los referencian) y **eliminar** los que nunca tuvieron citas.
3. El sitio público (la sección "Servicios" y el selector del formulario de reserva) se actualiza solo, leyendo siempre `/api/services`.

La base de datos arranca la primera vez con 3 servicios de ejemplo (definidos en `server/src/config.js`, `DEFAULT_SERVICES`, solo como semilla inicial) — reemplázalos por los tuyos desde `/admin.html` antes de publicar.

`/admin.html` no está enlazada desde el sitio ni aparece en el sitemap (lleva `noindex`), pero no depende de eso para estar segura: cada acción pasa por los endpoints `/api/admin/*`, protegidos por `ADMIN_TOKEN` en el backend.

## Configurar la sincronización con Google Calendar

Se usa un **Service Account** de Google Cloud, así el backend agenda directamente sin que nadie tenga que iniciar sesión cada vez.

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) y crea (o reutiliza) un proyecto.
2. Habilita la **Google Calendar API** (menú "APIs y servicios" → "Habilitar APIs y servicios").
3. Crea una **cuenta de servicio** ("APIs y servicios" → "Credenciales" → "Crear credenciales" → "Cuenta de servicio").
4. Dentro de la cuenta de servicio, ve a "Claves" → "Agregar clave" → "Crear clave nueva" → JSON. Descarga el archivo (ej. `service-account.json`) y **no lo subas al repositorio**.
5. Copia el email de la cuenta de servicio (algo como `nombre@proyecto.iam.gserviceaccount.com`).
6. En [Google Calendar](https://calendar.google.com/), abre el calendario que quieres usar para las citas (puede ser el calendario principal del negocio, o uno nuevo creado solo para esto) → "Configuración y uso compartido" → "Compartir con determinadas personas" → agrega el email de la cuenta de servicio con permiso **"Realizar cambios en los eventos"**.
7. Copia el **ID de calendario** desde esa misma pantalla ("Integrar el calendario" → "ID de calendario"; para el calendario principal suele ser el correo de la cuenta de Google).
8. En `server/.env`, define:
   - `GOOGLE_CALENDAR_ID` con el ID del paso 7.
   - `GOOGLE_SERVICE_ACCOUNT_JSON` con el contenido del JSON descargado (todo en una sola línea), **o** `GOOGLE_APPLICATION_CREDENTIALS` con la ruta al archivo si prefieres dejarlo como archivo en el servidor.
9. Reinicia el backend. Al reservar, la respuesta debe traer `calendarSynced: true` y el evento debe aparecer en el calendario.

## API

- `GET /api/services` — lista de servicios **activos** (id, nombre, descripción, duración en minutos). La consume el formulario público.
- `GET /api/availability?date=YYYY-MM-DD&service=<id>` — horarios libres ese día para ese servicio.
- `POST /api/appointments` — crea una reserva. Body JSON: `{ service, date, time, name, phone, email?, notes? }`.
- `GET /api/appointments` — lista las próximas citas (requiere el header `x-admin-token`).
- `GET /api/admin/services` — lista todos los servicios, activos e inactivos (admin).
- `POST /api/admin/services` — crea un servicio. Body JSON: `{ name, description?, duration }` (admin).
- `PUT /api/admin/services/:id` — actualiza nombre, descripción, duración o estado activo/inactivo (admin).
- `DELETE /api/admin/services/:id` — elimina el servicio, o lo desactiva si ya tiene citas asociadas (admin).

Los endpoints marcados "(admin)" requieren el header `x-admin-token` con el valor de `ADMIN_TOKEN`; `/admin.html` los usa automáticamente tras iniciar sesión.

## Horario de atención (usado para calcular disponibilidad)

- Lunes a sábado: 10:00 a. m. – 9:00 p. m.
- Domingo: 10:00 a. m. – 5:00 p. m.

Se puede ajustar en `server/src/config.js` (`BUSINESS_HOURS`). La duración de cada servicio se administra desde `/admin.html`, no en este archivo.

## Pendiente antes de publicar

- Dominio real (hoy el `<link rel="canonical">` de `public/index.html` usa un placeholder).
- RUC / razón social en el footer.
- Fotos reales del local y el equipo.
- Desplegar el backend en un servidor con Node (Render, Railway, un VPS, etc.) y apuntar el dominio ahí.

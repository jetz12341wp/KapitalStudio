# Kápital Studio (reservas por WhatsApp + agenda de días no disponibles)

Sitio web de Kápital Studio (Av. Las Palmeras #5194, Los Olivos). Es casi todo estático (HTML + Tailwind CDN, sin build), salvo por una sola pieza dinámica: una base de datos D1 que guarda qué días el negocio NO atiende, para que el formulario de reservas avise si alguien elige uno de esos días.

- `public/` — todo el sitio (HTML + Tailwind CDN, sin build).
- Los servicios y precios están escritos directamente en `public/index.html` (no vienen de ninguna base de datos).
- Todos los botones "Reservar" (nav, hero, tarjetas de servicio, CTA final, botón flotante) llevan a la sección **Agenda tu cita**, donde está el formulario. Al enviarlo, el formulario arma un mensaje de WhatsApp con los datos que la persona escribió (servicio, nombre, teléfono, fecha preferida, hora preferida, notas) y abre `wa.me` con ese mensaje ya listo para enviar. Si el clic fue desde una tarjeta de servicio, el formulario preselecciona automáticamente ese servicio. No se guarda nada en ningún servidor — el envío final lo hace la propia app de WhatsApp de quien reserva.
- WhatsApp del negocio: **+51 910 085 081**.

## Cómo desplegar

Se publica en Cloudflare Workers (assets estáticos + una función pequeña para la agenda). Antes del primer despliegue hay que crear la base de datos D1 — son 3 pasos únicos, después de eso cada `git push` a `main` despliega solo (si el proyecto está conectado a GitHub en Cloudflare).

### Primera vez: crear la base de datos D1

1. **Crear la base de datos.** Necesitas tener `wrangler` con sesión iniciada en tu cuenta de Cloudflare (`npx wrangler login` si nunca lo hiciste). Luego, desde la carpeta del proyecto:
   ```bash
   npx wrangler d1 create kapital-studio-db
   ```
   Esto imprime algo como `database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`.
   *(Alternativa sin terminal: en el dashboard de Cloudflare → Workers y Pages → D1 → Create database, nómbrala `kapital-studio-db` y copia el ID que te muestre.)*

2. **Pegar ese ID en `wrangler.toml`.** Reemplaza el valor de `database_id` (ahora mismo dice `"PENDIENTE-pega-aqui-el-id-que-te-de-cloudflare"`) por el ID real que te dio el paso anterior, y sube ese cambio a GitHub.

3. **Crear la tabla en la base de datos real** (una sola vez):
   ```bash
   npm run db:migrate:remote
   ```

Con esos 3 pasos hechos, `npm run deploy` (o el despliegue automático por GitHub) ya funciona. Los pasos 1 y 3 requieren la terminal con `wrangler` autenticado — si no tienes eso configurado en tu computadora, dímelo y vemos la alternativa por dashboard paso a paso.

Para previsualizar en local antes de publicar:

```bash
npm install
npm run dev
```

## Cambiar el número de WhatsApp

El número está repetido en varios lugares de `public/index.html` (nav, hero, tarjetas de servicio, formulario, CTA final, footer, botón flotante) en el formato `51910085081` dentro de enlaces `https://wa.me/51910085081?...`. Para cambiarlo, reemplaza ese número en todas las ocurrencias del archivo.

## Agenda de días no disponibles

Entra a **`tu-sitio.com/admin`** (o `/admin.html`) e ingresa la clave de acceso — está guardada en `wrangler.toml`, en `[vars] ADMIN_TOKEN` — para:

- Ver los días marcados como no disponibles.
- Bloquear un nuevo día (con un motivo opcional: "Feriado", "Vacaciones", etc.).
- Liberar un día que ya no está bloqueado.

Esos días bloqueados se guardan en la base de datos D1 y el formulario de la sección **Agenda tu cita** los consulta automáticamente: si alguien elige una de esas fechas, el formulario le avisa que no está disponible y no lo deja enviar el mensaje de WhatsApp para ese día.

**Seguridad de la clave:** el `ADMIN_TOKEN` en `wrangler.toml` es la única protección de `/admin` — cualquiera con esa clave puede bloquear o liberar días. Como el repositorio de GitHub podría ser visible para otras personas, no compartas el link del repositorio ni el archivo `wrangler.toml` fuera de quien deba administrar el sitio, y cambia esa clave si alguna vez sospechas que se filtró (edita el valor en `wrangler.toml` y vuelve a desplegar).

Esto **no reemplaza** el flujo de reservas por WhatsApp: las citas se siguen coordinando por WhatsApp como siempre; esto solo evita que alguien elija, en el formulario, un día en que el negocio ya sabe que no va a atender.

## Cambiar servicios o precios

Los 7 servicios están escritos directamente en `public/index.html`, en dos lugares que deben mantenerse coherentes:

1. Las tarjetas de la sección **Servicios y precios** (una sola cuadrícula con las 7, sin distinción entre destacadas y "más servicios") — el texto visible y el valor `data-service` de cada una (que precarga el servicio correcto en el formulario).
2. El `<select>` del formulario en la sección **Agenda tu cita** (`id="service"`), con el mismo texto.

Para agregar, quitar o modificar un servicio, edita ambos lugares.

## Horario de atención

- Todos los días: 10:00 a. m. – 9:00 p. m.

## Logo

El nav y el hero usan la imagen real del logo (`public/logo.png`) con `<img src="logo.png">`. El archivo tiene fondo negro sólido (sin transparencia), así que:

- En el **hero** (fondo negro) se funde sin bordes visibles.
- En el **nav** (fondo blanco) va dentro de una placa oscura (`.brand-nav`, en el `<style>` de `index.html`) para que no se vea como un recuadro negro suelto sobre el blanco.

El tamaño se controla con CSS propio (`.brand-nav img` y `.brand-logo img`), no con clases de Tailwind, para que no dependa de que el script de Tailwind CDN cargue a tiempo.

Para reemplazar el logo más adelante (otro diseño, versión con fondo transparente, etc.), solo sube el nuevo archivo a `public/logo.png` desde GitHub (**Add file → Upload files** dentro de la carpeta `public/`, manteniendo el nombre `logo.png`) y confirma el commit — no hace falta tocar el HTML.

## Fotos de servicios

Las 7 tarjetas de la sección **Servicios y precios** usan fotos reales en `public/img/`:

`corteclasico.jpeg`, `cortedegradado.jpeg`, `corteatijera.jpeg`, `perfiladodebarba.jpeg`, `limpiezafacial.jpeg`, `ondulacion.jpeg`, `tinte.jpeg`.

Cada `<div class="service-visual">` tiene un `<img>` con `object-fit:contain` (no `cover`): la foto se muestra **completa, sin recortar nada**, dentro de un recuadro uniforme (`aspect-ratio:4/5`) — si la foto no encaja exacto en esa proporción, se ve un pequeño margen del degradado de marca a los lados o arriba/abajo, nunca se corta la imagen. Para cambiar una foto, sube el nuevo archivo a `public/img/` con el mismo nombre desde GitHub (**Add file → Upload files**) y confirma el commit — no hace falta tocar el HTML.

## Pendiente antes de publicar

- **Crear la base de datos D1 y pegar su ID en `wrangler.toml`** — ver "Cómo desplegar" arriba. Sin esto, el sitio no despliega.
- Dominio propio (hoy el `<link rel="canonical">` y el correo de `libro-de-reclamaciones.html` usan `TU-DOMINIO-AQUI.pe` como placeholder).
- RUC / razón social en el footer.
- Fotos reales del local y el equipo (las de servicios ya están, ver sección "Fotos de servicios" arriba).
- Confirmar que el número de WhatsApp +51 910 085 081 es el correcto y tiene WhatsApp Business activo para responder rápido.

## Redes sociales

Instagram y TikTok están enlazados en tres lugares de `public/index.html`: la sección **Síguenos** (las dos tarjetas grandes con degradado, antes del CTA final), los íconos chicos en el footer, y el campo `sameAs` del JSON-LD (`HairSalon`) para SEO. Los tres apuntan a:

- Instagram: `https://www.instagram.com/kapital.barbershop/`
- TikTok: `https://www.tiktok.com/@kapital_barber_shop`

Para cambiar el usuario o agregar otra red, busca esas mismas URLs en el archivo y reemplázalas en los tres lugares.

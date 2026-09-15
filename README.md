# Kápital Studio — sitio 100% estático (reservas por WhatsApp)

Sitio web de Kápital Studio (Av. Las Palmeras #5194, Los Olivos). Es un sitio **completamente estático**: no hay backend, no hay base de datos, no hay nada que configurar en Cloudflare (ni D1, ni bindings, ni variables de entorno). Se publica y funciona tal cual.

- `public/` — todo el sitio (HTML + Tailwind CDN, sin build).
- Los servicios y precios están escritos directamente en `public/index.html` (no vienen de ninguna base de datos).
- Todos los botones "Reservar" (nav, hero, tarjetas de servicio, CTA final, botón flotante) llevan a la sección **Agenda tu cita**, donde está el formulario. Al enviarlo, el formulario arma un mensaje de WhatsApp con los datos que la persona escribió (servicio, nombre, teléfono, fecha preferida, hora preferida, notas) y abre `wa.me` con ese mensaje ya listo para enviar. Si el clic fue desde una tarjeta de servicio, el formulario preselecciona automáticamente ese servicio. No se guarda nada en ningún servidor — el envío final lo hace la propia app de WhatsApp de quien reserva.
- WhatsApp del negocio: **+51 910 085 081**.

## Cómo desplegar

Al ser un sitio estático, cualquier hosting de archivos estáticos sirve. Con Cloudflare (Workers con assets, sin backend):

```bash
npm install
npm run deploy
```

`wrangler.toml` solo tiene `[assets] directory = "public"` — no requiere ningún binding, base de datos ni variable de entorno. Si el proyecto está conectado a GitHub en Cloudflare, cada push a `main` lo despliega solo.

Para previsualizar en local antes de publicar:

```bash
npm run dev
```

## Cambiar el número de WhatsApp

El número está repetido en varios lugares de `public/index.html` (nav, hero, tarjetas de servicio, carrusel, formulario, CTA final, footer, botón flotante) en el formato `51910085081` dentro de enlaces `https://wa.me/51910085081?...`. Para cambiarlo, reemplaza ese número en todas las ocurrencias del archivo.

## Cambiar servicios o precios

No hay panel de administración ni base de datos: los 7 servicios están escritos directamente en `public/index.html`, en dos lugares que deben mantenerse coherentes:

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

- Dominio propio (hoy el `<link rel="canonical">` y el correo de `libro-de-reclamaciones.html` usan `TU-DOMINIO-AQUI.pe` como placeholder).
- RUC / razón social en el footer.
- Fotos reales del local y el equipo (las de servicios ya están, ver sección "Fotos de servicios" arriba).
- Confirmar que el número de WhatsApp +51 910 085 081 es el correcto y tiene WhatsApp Business activo para responder rápido.

## Redes sociales

Instagram y TikTok están enlazados en tres lugares de `public/index.html`: la sección **Síguenos** (las dos tarjetas grandes con degradado, antes del CTA final), los íconos chicos en el footer, y el campo `sameAs` del JSON-LD (`HairSalon`) para SEO. Los tres apuntan a:

- Instagram: `https://www.instagram.com/kapital.barbershop/`
- TikTok: `https://www.tiktok.com/@kapital_barber_shop`

Para cambiar el usuario o agregar otra red, busca esas mismas URLs en el archivo y reemplázalas en los tres lugares.

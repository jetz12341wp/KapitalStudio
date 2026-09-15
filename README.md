# Kápital Studio — sitio 100% estático (reservas por WhatsApp)

Sitio web de Kápital Studio (Av. Las Palmeras #5194, Los Olivos). Es un sitio **completamente estático**: no hay backend, no hay base de datos, no hay nada que configurar en Cloudflare (ni D1, ni bindings, ni variables de entorno). Se publica y funciona tal cual.

- `public/` — todo el sitio (HTML + Tailwind CDN, sin build).
- Los servicios y precios están escritos directamente en `public/index.html` (no vienen de ninguna base de datos).
- Todos los botones "Reservar" (nav, hero, tarjetas de servicio, carrusel, CTA final, botón flotante) llevan a la sección **Agenda tu cita**, donde está el formulario. Al enviarlo, el formulario arma un mensaje de WhatsApp con los datos que la persona escribió (servicio, nombre, teléfono, fecha preferida, hora preferida, notas) y abre `wa.me` con ese mensaje ya listo para enviar. Si el clic fue desde una tarjeta de servicio, el formulario preselecciona automáticamente ese servicio. No se guarda nada en ningún servidor — el envío final lo hace la propia app de WhatsApp de quien reserva.
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

1. Las tarjetas de la sección **Servicios** (3 destacadas + 4 en el carrusel) — el texto visible y el enlace de WhatsApp de cada una (que ya trae el nombre y precio del servicio en el mensaje).
2. El `<select>` del formulario en la sección **Agenda tu cita** (`id="service"`), con el mismo texto.

Para agregar, quitar o modificar un servicio, edita ambos lugares.

## Horario de atención

- Todos los días: 10:00 a. m. – 9:00 p. m.

## Logo

El header y el hero recrean el logo de Kápital Studio (arco, wordmark "KÁPITAL", "STUDIO" con estrellas) con CSS y la fuente Cinzel, no con el archivo de imagen original: no fue posible extraer el PNG compartido como referencia en el entorno donde se generó este sitio. Si tienes el archivo original (PNG/SVG), puedes reemplazar ese bloque por una etiqueta `<img>` apuntando a `public/logo.png`.

## Pendiente antes de publicar

- Dominio propio (hoy el `<link rel="canonical">` y el correo de `libro-de-reclamaciones.html` usan `TU-DOMINIO-AQUI.pe` como placeholder).
- Logo real como archivo de imagen (ver sección "Logo" arriba), si no quieres quedarte con la recreación tipográfica.
- RUC / razón social en el footer.
- Redes sociales reales del negocio (hoy no hay ninguna enlazada).
- Fotos reales del local y el equipo.
- Confirmar que el número de WhatsApp +51 910 085 081 es el correcto y tiene WhatsApp Business activo para responder rápido.

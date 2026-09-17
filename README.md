# Kápital Studio (reservas por WhatsApp + agenda de días no disponibles)

Sitio web de Kápital Studio (Av. Las Palmeras #5194, Los Olivos). Es casi todo estático (HTML + Tailwind CDN, sin build), salvo por una sola pieza dinámica: una base de datos D1 que guarda qué días el negocio NO atiende, para que el formulario de reservas avise si alguien elige uno de esos días.

- `public/` — todo el sitio (HTML + Tailwind CDN, sin build).
- Los servicios y precios están escritos directamente en `public/index.html` (no vienen de ninguna base de datos).
- Todos los botones "Reservar" (nav, hero, tarjetas de servicio, CTA final, botón flotante) llevan a la sección **Agenda tu cita**, donde está el formulario. Todos los campos son obligatorios excepto "Notas". Al enviarlo, el formulario verifica disponibilidad (ver "Personas y disponibilidad por horario" abajo), guarda la cita en D1 y arma un mensaje de WhatsApp con los datos (servicio, con quién, nombre, teléfono, fecha, hora, notas) que abre en `wa.me` listo para enviar. Si el clic fue desde una tarjeta de servicio, el formulario preselecciona automáticamente ese servicio.
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

3. **Crear las tablas en la base de datos real** (una sola vez):
   ```bash
   npm run db:migrate:remote
   ```
   Este comando aplica todos los archivos de `migrations/` que todavía no se hayan ejecutado en la base remota — si en el futuro agrego una nueva tabla, alcanza con correr este mismo comando de nuevo, no hace falta repetir los pasos 1 y 2.
   *(Alternativa sin terminal: dentro de tu base en el dashboard → pestaña "Console" → pega y ejecuta el contenido de cada archivo `.sql` de la carpeta `migrations/`, en orden.)*

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

## Personas y disponibilidad por horario

El formulario tiene un campo **"¿Con quién deseas que te atienda?"** con `Cualquiera disponible` más una opción por cada persona del equipo. Las personas pueden atender en simultáneo — una misma fecha y hora admite una cita por persona — y una hora recién se considera completa cuando todas están ocupadas, en almuerzo o no disponibles ahí. Las citas se pueden agendar de **10:00 am a 8:00 pm** (última hora reservable).

La lista de personas ya **no está escrita a mano en el código**: vive en la base D1 (tabla `personas`) y se administra desde `/admin`, sección **"Personas que atienden"** (ver más abajo). El formulario público carga esa lista automáticamente al abrir la página (`GET /api/personas`).

Cada persona tiene su propio horario de almuerzo (configurable, ver abajo), en el que no se le puede agendar. Al elegir una persona específica en el formulario, las horas de su almuerzo **desaparecen directamente de la lista de horas** (no hace falta ni intentar elegirlas); si se elige "Cualquiera disponible" se muestran todas las horas, porque siempre puede haber alguien más libre en ese horario.

Esto se verifica justo al hacer clic en **"Enviar por WhatsApp"**:

1. Si falta completar algún campo obligatorio (todos menos "Notas"), aparece un recuadro de alerta listando qué falta y no se envía nada.
2. Si se eligió una persona específica y esa persona ya tiene una cita en esa fecha y hora, está en su horario de almuerzo, fue marcada como que ya no recibe citas, o fue marcada como no disponible desde `/admin` para esa fecha/hora puntual (ver "Indisponibilidad de personal" abajo), aparece un aviso específico pidiendo elegir otra persona, hora o día.
3. Si se eligió "Cualquiera disponible", el sitio asigna automáticamente a la primera persona libre en ese horario (descartando ocupadas, en almuerzo, que ya no reciben citas, o no disponibles); si ninguna está libre, avisa que el horario está completo.
4. Si todo está disponible, la cita se guarda (tabla `citas` en D1) y recién ahí se abre WhatsApp con el mensaje, incluyendo con qué persona quedó la cita. Después de enviar, el formulario se limpia solo para la siguiente persona.

El servidor (`src/index.js`) vuelve a validar el horario de almuerzo, si la persona sigue activa y la indisponibilidad al guardar la cita, así que aunque alguien llame a la API directamente sin pasar por el formulario, no puede saltarse estas reglas.

### Agregar, quitar o editar el horario de almuerzo del equipo

En **`/admin`** (misma clave que para los días bloqueados), sección **"Personas que atienden"**:

- **Agregar una persona nueva**: escribe su nombre completo, elige (opcionalmente) su horario de almuerzo "desde" y "hasta", y presiona **"Agregar persona"**. Aparece de inmediato como opción en el formulario del sitio.
- **Cambiar el horario de almuerzo** de alguien ya existente: en su fila, elige las nuevas horas "desde"/"hasta" y presiona **"Guardar horario de almuerzo"**. Si no debe tener almuerzo bloqueado, deja ambos selectores en "—".
- **Marcar que ya no recibe citas** (por ejemplo, dejó de trabajar en el local, o está de vacaciones por tiempo indefinido): botón **"Marcar no disponible"** en su fila — pide un motivo, que se le muestra al cliente en el formulario si intenta elegir a esa persona. Para que vuelva a recibir citas, presiona **"Reactivar"**.
- **Eliminar** a alguien de la lista por completo: botón **"Eliminar"** en su fila. Las citas ya guardadas con esa persona no se borran, solo deja de aparecer como opción para citas nuevas.

### Indisponibilidad de personal por fecha (vacaciones cortas, citas médicas, etc.)

Además del horario de almuerzo fijo, en **`/admin`**, sección **"Indisponibilidad de personal"**, se puede marcar a cualquiera del equipo como no disponible para una fecha puntual:

- **Todo un día** (por ejemplo, vacaciones o descanso médico): marca la casilla "Todo el día".
- **Solo una hora puntual** dentro de su horario (por ejemplo, una cita médica a las 4:00 pm): elige la hora en vez de marcar "Todo el día".

Esa persona deja de aparecer como disponible en el formulario de reservas para esa fecha/hora automáticamente (tabla `indisponibilidad_personas` en D1). Para liberar el bloqueo antes de tiempo, busca la fecha en la lista de abajo del mismo panel y presiona "Liberar".

> La diferencia con "Marcar no disponible" de la sección anterior: esto último es indefinido (hasta que se reactive a la persona), mientras que la indisponibilidad de esta sección es para una fecha específica.

### Ver, cancelar o corregir una cita

En **`/admin`** (misma clave que para los días bloqueados), sección **"Citas reservadas"**:

- Elige una fecha para ver quién tiene cita ese día (persona, nombre, teléfono, servicio).
- Botón **"Cancelar"** en cada fila para liberar ese horario (por ejemplo, si alguien reservó con la persona equivocada).

También se puede ver todo directo en la base: dashboard de Cloudflare → tu base `kapital-studio-db` → pestaña "Console" → `SELECT * FROM citas ORDER BY fecha, hora;` (esta tabla sí guarda nombre y teléfono del cliente, a diferencia de `dias_bloqueados`).

## Cambiar servicios o precios

Los 7 servicios están escritos directamente en `public/index.html`, en dos lugares que deben mantenerse coherentes:

1. Las tarjetas de la sección **Servicios y precios** (una sola cuadrícula con las 7, sin distinción entre destacadas y "más servicios") — el texto visible y el valor `data-service` de cada una (que precarga el servicio correcto en el formulario).
2. El `<select>` del formulario en la sección **Agenda tu cita** (`id="service"`), con el mismo texto.

Para agregar, quitar o modificar un servicio, edita ambos lugares.

## Horario de atención

- Todos los días: 10:00 a. m. – 9:00 p. m.
- El formulario de citas solo permite reservar de 10:00 am a 8:00 pm (última hora reservable), para que la cita alcance a completarse antes del cierre.

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

- **Correr `npm run db:migrate:remote`** (o pegar el SQL de `migrations/0002_citas.sql`, `migrations/0003_indisponibilidad.sql` y `migrations/0004_personas.sql` en la Console de Cloudflare) para crear las tablas `citas`, `indisponibilidad_personas` y `personas` en la base real. Sin este paso, el formulario no podrá guardar ni consultar citas, y los paneles de personas / indisponibilidad no funcionarán.
- Dominio propio (hoy el `<link rel="canonical">` y el correo de `libro-de-reclamaciones.html` usan `TU-DOMINIO-AQUI.pe` como placeholder).
- RUC / razón social en el footer.
- Fotos reales del local y el equipo (las de servicios ya están, ver sección "Fotos de servicios" arriba).
- Confirmar que el número de WhatsApp +51 910 085 081 es el correcto y tiene WhatsApp Business activo para responder rápido.

## Redes sociales

Instagram, TikTok y Facebook están enlazados en tres lugares de `public/index.html`: la sección **Síguenos** (las tres tarjetas con degradado, antes del CTA final), los íconos chicos en el footer, y el campo `sameAs` del JSON-LD (`HairSalon`) para SEO. Apuntan a:

- Instagram: `https://www.instagram.com/kapital.barbershop/`
- TikTok: `https://www.tiktok.com/@kapital_barber_shop`
- Facebook: `https://www.facebook.com/KapitalStudio.pe`

Para cambiar el usuario o agregar otra red, busca esas mismas URLs en el archivo y reemplázalas en los tres lugares.

## Vista en celular (sin tocar el diseño de escritorio)

Dos ajustes que solo aplican en pantallas angostas (`max-width:639px` en el `<style>` de `index.html`), sin modificar nada en la vista de escritorio/tablet:

- **Redes sociales compactas**: la sección "Síguenos" (`#redes-grid`) reduce el tamaño de las tarjetas de Instagram/TikTok/Facebook para que se vean parecidas en tamaño a las de "Formas de pago" (íconos más chicos, sin el nombre de usuario ni el texto "Seguir →"), sin dejar de ser visibles.
- **Servicios y Productos en carrusel**: `#servicios-grid` y `#productos-grid` pasan de cuadrícula a un carrusel horizontal deslizable (scroll con "snap"), mostrando una tarjeta grande a la vez. En escritorio ambas siguen siendo la cuadrícula normal.

## Formas de pago

Sección **"Formas de pago"** (entre Ubicación y FAQ) con 3 insignias: Efectivo, Yape y Plin. Son solo visuales (íconos genéricos con los colores de marca de cada uno, no los logos oficiales) — no procesan ningún pago, solo le avisan al cliente qué medios acepta el negocio en el local. Para agregar o quitar un medio de pago, edita el bloque `<!-- FORMAS DE PAGO -->` en `public/index.html`.

## Productos

Nueva sección **"Productos"** (entre Servicios y Nosotros) con 5 productos de ejemplo (`Producto 1` a `Producto 5`, con precios y descripciones genéricas de ejemplo) para que reemplaces con tus productos reales. Usa un color azul (en vez del rojo de Servicios) para diferenciarse visualmente, combinando igual con la marca.

Cada tarjeta tiene un selector de cantidad y dos botones:

- **Comprar ahora** — abre WhatsApp directo con ese producto y la cantidad elegida, sin pasar por el carrito.
- **Agregar al carrito** — lo suma a un carrito (aparece un botón flotante azul abajo a la izquierda, con la cantidad de artículos). Al abrir el carrito se ve el detalle por producto (cantidad y subtotal) y el total; el botón **"Finalizar compra por WhatsApp"** arma un solo mensaje con todos los productos, cantidades y el monto total, y recién ahí abre WhatsApp.

El carrito vive solo en la memoria de la página (no se guarda en ningún lado): si la persona recarga el sitio, el carrito se vacía.

Para reemplazar los productos de ejemplo por los reales, en `public/index.html` busca `id="productos-grid"` y edita, para cada `<article class="product-card">`:

1. Los atributos `data-product-id`, `data-product-name` y `data-product-price` (el precio en soles, solo el número).
2. El texto visible: nombre (`<h3>`), descripción (`<p class="product-desc">`) y precio mostrado (`<span class="product-price">`).

Dile a Claude los 5 productos (nombre, precio y descripción breve) y se actualiza todo junto, en el mismo formato.

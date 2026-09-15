import { listAllServices, getService, createService } from '../../_lib/db.js';
import { serializeAdmin, validateDuration, validatePrice } from '../../_lib/services.js';
import { uniqueSlug } from '../../_lib/slug.js';
import { isAdmin, unauthorized } from '../../_lib/adminAuth.js';
import { json } from '../../_lib/http.js';

// GET /api/admin/services — lista todos los servicios, activos e inactivos.
export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return unauthorized();
  const services = await listAllServices(env.DB);
  return json(services.map(serializeAdmin));
}

// POST /api/admin/services — crea un servicio nuevo.
export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const { name, description, duration, price, priceIsFrom } = body;

  if (!name || !name.trim()) return json({ error: 'El nombre es obligatorio.' }, 400);
  if (!validateDuration(duration)) {
    return json({ error: 'La duración debe ser un número de minutos entre 1 y 480.' }, 400);
  }
  if (!validatePrice(price)) {
    return json({ error: 'El precio debe ser un número mayor o igual a 0.' }, 400);
  }

  const id = await uniqueSlug(name, async (candidate) => Boolean(await getService(env.DB, candidate)));
  const service = await createService(env.DB, {
    id,
    name: name.trim(),
    description: description ? description.trim() : null,
    duration: Number(duration),
    price: price === undefined || price === null || price === '' ? undefined : Number(price),
    priceIsFrom: Boolean(priceIsFrom),
  });
  return json(serializeAdmin(service), 201);
}

import { getService, updateService, deleteService, countAppointmentsForService } from '../../../_lib/db.js';
import { serializeAdmin, validateDuration, validatePrice } from '../../../_lib/services.js';
import { isAdmin, unauthorized } from '../../../_lib/adminAuth.js';
import { json } from '../../../_lib/http.js';

// PUT /api/admin/services/:id — actualiza nombre, descripción, duración, precio o estado activo.
export async function onRequestPut({ request, env, params }) {
  if (!isAdmin(request, env)) return unauthorized();

  const id = params.id;
  const existing = await getService(env.DB, id);
  if (!existing) return json({ error: 'Servicio no encontrado.' }, 404);

  const body = await request.json().catch(() => ({}));
  const { name, description, duration, price, priceIsFrom, active } = body;

  if (name !== undefined && !name.trim()) {
    return json({ error: 'El nombre no puede quedar vacío.' }, 400);
  }
  if (duration !== undefined && !validateDuration(duration)) {
    return json({ error: 'La duración debe ser un número de minutos entre 1 y 480.' }, 400);
  }
  if (price !== undefined && !validatePrice(price)) {
    return json({ error: 'El precio debe ser un número mayor o igual a 0.' }, 400);
  }

  const updated = await updateService(env.DB, id, {
    name: name !== undefined ? name.trim() : undefined,
    description: description !== undefined ? (description ? description.trim() : null) : undefined,
    duration: duration !== undefined ? Number(duration) : undefined,
    price: price !== undefined ? (price === null || price === '' ? null : Number(price)) : undefined,
    priceIsFrom: priceIsFrom !== undefined ? Boolean(priceIsFrom) : undefined,
    active: active !== undefined ? Boolean(active) : undefined,
  });
  return json(serializeAdmin(updated));
}

// DELETE /api/admin/services/:id — elimina el servicio, o lo desactiva si ya tiene citas asociadas.
export async function onRequestDelete({ request, env, params }) {
  if (!isAdmin(request, env)) return unauthorized();

  const id = params.id;
  const existing = await getService(env.DB, id);
  if (!existing) return json({ error: 'Servicio no encontrado.' }, 404);

  const appointmentsCount = await countAppointmentsForService(env.DB, id);
  if (appointmentsCount > 0) {
    const updated = await updateService(env.DB, id, { active: false });
    return json({ ...serializeAdmin(updated), deactivatedInstead: true });
  }

  await deleteService(env.DB, id);
  return new Response(null, { status: 204 });
}

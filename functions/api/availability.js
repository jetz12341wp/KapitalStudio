import { getAppointmentsForDate, getActiveService } from '../_lib/db.js';
import { computeAvailableSlots } from '../_lib/availability.js';
import { json } from '../_lib/http.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/availability?date=YYYY-MM-DD&service=<id>
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const serviceId = url.searchParams.get('service');

  if (!date || !DATE_RE.test(date)) {
    return json({ error: 'Fecha inválida. Usa el formato YYYY-MM-DD.' }, 400);
  }
  const svc = await getActiveService(env.DB, serviceId);
  if (!svc) return json({ error: 'Servicio inválido.' }, 400);

  const existing = await getAppointmentsForDate(env.DB, date);
  const slots = computeAvailableSlots(date, svc.duration, existing);
  return json({ date, service: svc.id, slots });
}

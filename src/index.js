// Worker principal de Kápital Studio: sirve la API bajo /api/*. Los archivos
// estáticos de public/ (index.html, admin.html, etc.) los sirve Cloudflare
// directo vía el binding de assets configurado en wrangler.toml — este
// fetch() solo se invoca para rutas que NO coinciden con ningún archivo
// estático, que en la práctica es exactamente /api/*.

import {
  getAppointmentsForDate,
  insertAppointment,
  setCalendarEventId,
  listUpcomingAppointments,
  listActiveServices,
  listAllServices,
  getService,
  getActiveService,
  createService,
  updateService,
  deleteService,
  countAppointmentsForService,
} from './lib/db.js';
import { computeAvailableSlots, isSlotAvailable, toMinutes, toHHMM } from './lib/availability.js';
import { createAppointmentEvent } from './lib/googleCalendar.js';
import { isAdmin, unauthorized } from './lib/adminAuth.js';
import { uniqueSlug } from './lib/slug.js';
import { serializePublic, serializeAdmin, validateDuration, validatePrice } from './lib/services.js';
import { json } from './lib/http.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleServices(request, env) {
  const services = await listActiveServices(env.DB);
  return json(services.map(serializePublic));
}

async function handleAvailability(request, env) {
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

async function handleListAppointments(request, env) {
  if (!isAdmin(request, env)) return unauthorized();
  return json(await listUpcomingAppointments(env.DB));
}

async function handleCreateAppointment(request, env) {
  const body = await request.json().catch(() => ({}));
  const { service, date, time, name, phone, email, notes, website } = body;

  // Honeypot: si el campo oculto viene lleno, es un bot. Respondemos "ok" sin guardar nada.
  if (website) {
    return json({ id: null, calendarSynced: false });
  }

  const svc = await getActiveService(env.DB, service);
  if (!svc) return json({ error: 'Servicio inválido.' }, 400);
  if (!date || !DATE_RE.test(date)) return json({ error: 'Fecha inválida.' }, 400);
  if (!time || !TIME_RE.test(time)) return json({ error: 'Hora inválida.' }, 400);
  if (!name || !name.trim()) return json({ error: 'El nombre es obligatorio.' }, 400);
  if (!phone || !phone.trim()) return json({ error: 'El teléfono es obligatorio.' }, 400);
  if (email && !EMAIL_RE.test(email)) return json({ error: 'El correo no es válido.' }, 400);

  const existing = await getAppointmentsForDate(env.DB, date);
  if (!isSlotAvailable(date, time, svc.duration, existing)) {
    return json({ error: 'Ese horario ya no está disponible. Elige otro.' }, 409);
  }

  const endTime = toHHMM(toMinutes(time) + svc.duration);

  const id = await insertAppointment(env.DB, {
    service_id: svc.id,
    date,
    start_time: time,
    end_time: endTime,
    name: name.trim(),
    phone: phone.trim(),
    email: email ? email.trim() : null,
    notes: notes ? notes.trim() : null,
    calendar_event_id: null,
    status: 'confirmed',
  });

  let calendarSynced = false;
  try {
    const eventId = await createAppointmentEvent(env, {
      summary: `${svc.name} - ${name.trim()}`,
      description: [`Teléfono: ${phone.trim()}`, notes ? `Notas: ${notes.trim()}` : null].filter(Boolean).join('\n'),
      date,
      startTime: time,
      endTime,
      attendeeEmail: email ? email.trim() : null,
    });
    if (eventId) {
      await setCalendarEventId(env.DB, id, eventId);
      calendarSynced = true;
    }
  } catch (err) {
    // La cita ya quedó guardada en D1 aunque falle Google Calendar; no se
    // pierde la reserva del cliente por un problema de sincronización.
    console.error('No se pudo sincronizar con Google Calendar:', err.message);
  }

  return json({ id, calendarSynced }, 201);
}

async function handleListAllServices(request, env) {
  if (!isAdmin(request, env)) return unauthorized();
  const services = await listAllServices(env.DB);
  return json(services.map(serializeAdmin));
}

async function handleCreateService(request, env) {
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

async function handleUpdateService(request, env, id) {
  if (!isAdmin(request, env)) return unauthorized();

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

async function handleDeleteService(request, env, id) {
  if (!isAdmin(request, env)) return unauthorized();

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const { method } = request;

    try {
      if (pathname === '/api/services' && method === 'GET') return handleServices(request, env);
      if (pathname === '/api/availability' && method === 'GET') return handleAvailability(request, env);

      if (pathname === '/api/appointments' && method === 'GET') return handleListAppointments(request, env);
      if (pathname === '/api/appointments' && method === 'POST') return handleCreateAppointment(request, env);

      if (pathname === '/api/admin/services' && method === 'GET') return handleListAllServices(request, env);
      if (pathname === '/api/admin/services' && method === 'POST') return handleCreateService(request, env);

      const serviceIdMatch = pathname.match(/^\/api\/admin\/services\/([^/]+)$/);
      if (serviceIdMatch) {
        const id = decodeURIComponent(serviceIdMatch[1]);
        if (method === 'PUT') return handleUpdateService(request, env, id);
        if (method === 'DELETE') return handleDeleteService(request, env, id);
      }

      if (pathname.startsWith('/api/')) {
        return json({ error: 'No encontrado.' }, 404);
      }

      // Cualquier otra ruta ya debería haberla servido el binding de assets
      // (public/) antes de llegar aquí; si no, es un 404 genuino.
      return new Response('Not found', { status: 404 });
    } catch (err) {
      console.error(err);
      return json({ error: 'Error interno del servidor.' }, 500);
    }
  },
};

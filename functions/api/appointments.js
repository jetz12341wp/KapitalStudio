import {
  getAppointmentsForDate,
  insertAppointment,
  setCalendarEventId,
  listUpcomingAppointments,
  getActiveService,
} from '../_lib/db.js';
import { isSlotAvailable, toMinutes, toHHMM } from '../_lib/availability.js';
import { createAppointmentEvent } from '../_lib/googleCalendar.js';
import { isAdmin, unauthorized } from '../_lib/adminAuth.js';
import { json } from '../_lib/http.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/appointments — lista las próximas citas (admin, requiere x-admin-token).
export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return unauthorized();
  const appointments = await listUpcomingAppointments(env.DB);
  return json(appointments);
}

// POST /api/appointments — crea una reserva.
export async function onRequestPost({ request, env }) {
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

const express = require('express');
const { SERVICES, findService, ADMIN_TOKEN } = require('../config');
const { getAppointmentsForDate, insertAppointment, setCalendarEventId, listUpcomingAppointments } = require('../db');
const { computeAvailableSlots, isSlotAvailable, toMinutes, toHHMM } = require('../availability');
const { createAppointmentEvent } = require('../googleCalendar');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/services', (req, res) => {
  res.json(SERVICES);
});

router.get('/availability', (req, res) => {
  const { date, service } = req.query;
  if (!date || !DATE_RE.test(date)) {
    return res.status(400).json({ error: 'Fecha inválida. Usa el formato YYYY-MM-DD.' });
  }
  const svc = findService(service);
  if (!svc) {
    return res.status(400).json({ error: 'Servicio inválido.' });
  }
  const existing = getAppointmentsForDate(date);
  const slots = computeAvailableSlots(date, svc.duration, existing);
  res.json({ date, service: svc.id, slots });
});

router.post('/appointments', async (req, res) => {
  const { service, date, time, name, phone, email, notes, website } = req.body || {};

  // Honeypot: si el campo oculto viene lleno, es un bot. Respondemos "ok" sin guardar nada.
  if (website) {
    return res.json({ id: null, calendarSynced: false });
  }

  const svc = findService(service);
  if (!svc) return res.status(400).json({ error: 'Servicio inválido.' });
  if (!date || !DATE_RE.test(date)) return res.status(400).json({ error: 'Fecha inválida.' });
  if (!time || !TIME_RE.test(time)) return res.status(400).json({ error: 'Hora inválida.' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  if (!phone || !phone.trim()) return res.status(400).json({ error: 'El teléfono es obligatorio.' });
  if (email && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'El correo no es válido.' });

  const existing = getAppointmentsForDate(date);
  if (!isSlotAvailable(date, time, svc.duration, existing)) {
    return res.status(409).json({ error: 'Ese horario ya no está disponible. Elige otro.' });
  }

  const endTime = toHHMM(toMinutes(time) + svc.duration);

  const id = insertAppointment({
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
    const eventId = await createAppointmentEvent({
      summary: `${svc.name} - ${name.trim()}`,
      description: [`Teléfono: ${phone.trim()}`, notes ? `Notas: ${notes.trim()}` : null]
        .filter(Boolean)
        .join('\n'),
      date,
      startTime: time,
      endTime,
      attendeeEmail: email ? email.trim() : null,
    });
    if (eventId) {
      setCalendarEventId(id, eventId);
      calendarSynced = true;
    }
  } catch (err) {
    // La cita ya quedó guardada en la base de datos aunque falle Google Calendar;
    // no se pierde la reserva del cliente por un problema de sincronización.
    console.error('No se pudo sincronizar con Google Calendar:', err.message);
  }

  res.status(201).json({ id, calendarSynced });
});

router.get('/appointments', (req, res) => {
  if (!ADMIN_TOKEN || req.get('x-admin-token') !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  res.json(listUpcomingAppointments());
});

module.exports = router;

import { BUSINESS_HOURS, SLOT_STEP_MINUTES } from './config.js';

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// date: 'YYYY-MM-DD' interpretado en el huso horario del negocio (sin componente de hora,
// por lo que new Date(date) en UTC ya nos da el día de semana correcto).
function dayOfWeek(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function isPast(date, time) {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  if (date > todayIso) return false;
  if (date < todayIso) return true;
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  // Ajuste simple: comparamos en UTC vs. hora local del negocio (America/Lima = UTC-5, sin DST).
  const businessNowMinutes = nowMinutes - 5 * 60;
  return toMinutes(time) <= ((businessNowMinutes % 1440) + 1440) % 1440;
}

/**
 * Devuelve los horarios de inicio disponibles para un servicio en una fecha dada,
 * dentro del horario comercial y sin cruzarse con citas ya reservadas.
 */
function computeAvailableSlots(date, durationMinutes, existingAppointments) {
  const hours = BUSINESS_HOURS[dayOfWeek(date)];
  if (!hours) return [];

  const openMin = toMinutes(hours.open);
  const closeMin = toMinutes(hours.close);
  const busy = existingAppointments.map((a) => ({
    start: toMinutes(a.start_time),
    end: toMinutes(a.end_time),
  }));

  const slots = [];
  for (let start = openMin; start + durationMinutes <= closeMin; start += SLOT_STEP_MINUTES) {
    const end = start + durationMinutes;
    const overlaps = busy.some((b) => start < b.end && end > b.start);
    if (overlaps) continue;
    const time = toHHMM(start);
    if (isPast(date, time)) continue;
    slots.push(time);
  }
  return slots;
}

function isSlotAvailable(date, startTime, durationMinutes, existingAppointments) {
  const hours = BUSINESS_HOURS[dayOfWeek(date)];
  if (!hours) return false;
  const start = toMinutes(startTime);
  const end = start + durationMinutes;
  if (start < toMinutes(hours.open) || end > toMinutes(hours.close)) return false;
  if (isPast(date, startTime)) return false;
  return !existingAppointments.some((a) => {
    const bStart = toMinutes(a.start_time);
    const bEnd = toMinutes(a.end_time);
    return start < bEnd && end > bStart;
  });
}

export { computeAvailableSlots, isSlotAvailable, toMinutes, toHHMM, dayOfWeek };

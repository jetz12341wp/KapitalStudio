const { google } = require('googleapis');
const {
  GOOGLE_CALENDAR_ID,
  GOOGLE_SERVICE_ACCOUNT_JSON,
  GOOGLE_APPLICATION_CREDENTIALS,
  TIMEZONE,
  TIMEZONE_OFFSET,
} = require('./config');

let authClientPromise = null;

function isConfigured() {
  return Boolean(GOOGLE_CALENDAR_ID && (GOOGLE_SERVICE_ACCOUNT_JSON || GOOGLE_APPLICATION_CREDENTIALS));
}

function getAuth() {
  if (!authClientPromise) {
    const scopes = ['https://www.googleapis.com/auth/calendar.events'];
    if (GOOGLE_SERVICE_ACCOUNT_JSON) {
      const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
      authClientPromise = new google.auth.GoogleAuth({ credentials, scopes }).getClient();
    } else {
      // Usa GOOGLE_APPLICATION_CREDENTIALS (ruta a archivo JSON) automáticamente.
      authClientPromise = new google.auth.GoogleAuth({ scopes }).getClient();
    }
  }
  return authClientPromise;
}

/**
 * Crea un evento en el calendario de Google del negocio.
 * Requiere que el service account tenga permiso de "Hacer cambios en eventos"
 * sobre GOOGLE_CALENDAR_ID (ver server/README.md).
 * Devuelve el id del evento creado, o null si la integración no está configurada.
 */
async function createAppointmentEvent({ summary, description, date, startTime, endTime, attendeeEmail }) {
  if (!isConfigured()) return null;

  const auth = await getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary,
    description,
    start: { dateTime: `${date}T${startTime}:00${TIMEZONE_OFFSET}`, timeZone: TIMEZONE },
    end: { dateTime: `${date}T${endTime}:00${TIMEZONE_OFFSET}`, timeZone: TIMEZONE },
  };
  if (attendeeEmail) {
    event.attendees = [{ email: attendeeEmail }];
  }

  const res = await calendar.events.insert({
    calendarId: GOOGLE_CALENDAR_ID,
    requestBody: event,
    sendUpdates: attendeeEmail ? 'all' : 'none',
  });
  return res.data.id;
}

module.exports = { createAppointmentEvent, isConfigured };

// Sincronización con Google Calendar sin la librería `googleapis` (no corre en
// el runtime de Cloudflare Workers/Pages Functions): arma y firma a mano el JWT
// del service account con Web Crypto (crypto.subtle), y llama a la API REST de
// Calendar directamente con fetch. Todo esto son APIs web estándar, soportadas
// nativamente por Cloudflare.

function base64url(input) {
  let bytes;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(credentials) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(credentials.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`No se pudo obtener el token de Google: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

export function isConfigured(env) {
  return Boolean(env.GOOGLE_CALENDAR_ID && env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

/**
 * Crea un evento en el calendario de Google del negocio. Requiere que el
 * service account tenga permiso de "Hacer cambios en eventos" sobre
 * env.GOOGLE_CALENDAR_ID (ver README). Devuelve el id del evento creado,
 * o null si la integración no está configurada.
 */
export async function createAppointmentEvent(env, { summary, description, date, startTime, endTime, attendeeEmail }) {
  if (!isConfigured(env)) return null;

  const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const accessToken = await getAccessToken(credentials);
  const timeZone = env.BUSINESS_TIMEZONE || 'America/Lima';
  const offset = env.BUSINESS_TIMEZONE_OFFSET || '-05:00';

  const event = {
    summary,
    description,
    start: { dateTime: `${date}T${startTime}:00${offset}`, timeZone },
    end: { dateTime: `${date}T${endTime}:00${offset}`, timeZone },
  };
  if (attendeeEmail) event.attendees = [{ email: attendeeEmail }];

  const sendUpdates = attendeeEmail ? 'all' : 'none';
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events?sendUpdates=${sendUpdates}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );
  if (!res.ok) {
    throw new Error(`Google Calendar API error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.id;
}

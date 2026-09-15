require('dotenv').config();

// Servicios con los que arranca la base de datos la primera vez (solo semilla
// inicial). Una vez desplegado, el negocio los edita, borra o agrega los suyos
// desde /admin.html sin tocar este archivo. La duración de cada uno es una
// estimación razonable (el negocio no la especificó); ajústala desde el panel
// admin si no coincide con la real.
const DEFAULT_SERVICES = [
  { id: 'corte-clasico', name: 'Corte clásico', description: 'Corte tradicional a máquina y tijera.', duration: 30, price: 25 },
  { id: 'corte-degradado', name: 'Corte degradado', description: 'Fade / degradado a máquina.', duration: 30, price: 30 },
  { id: 'corte-a-tijera', name: 'Corte a tijera', description: 'Corte trabajado íntegramente a tijera.', duration: 40, price: 30 },
  { id: 'perfilado-de-barba', name: 'Perfilado de barba', description: 'Diseño y perfilado de barba.', duration: 15, price: 15 },
  { id: 'limpieza-facial', name: 'Limpieza facial', description: 'Limpieza facial profunda.', duration: 45, price: 50 },
  { id: 'ondulacion', name: 'Ondulación', description: 'Ondulación permanente.', duration: 90, price: 100 },
  { id: 'tinte', name: 'Tinte', description: 'Coloración de cabello.', duration: 60, price: 150, priceIsFrom: true },
];

// Todos los días, mismo horario.
const BUSINESS_HOURS = {
  0: { open: '10:00', close: '21:00' },
  1: { open: '10:00', close: '21:00' },
  2: { open: '10:00', close: '21:00' },
  3: { open: '10:00', close: '21:00' },
  4: { open: '10:00', close: '21:00' },
  5: { open: '10:00', close: '21:00' },
  6: { open: '10:00', close: '21:00' },
};

const SLOT_STEP_MINUTES = 30;
const TIMEZONE = process.env.BUSINESS_TIMEZONE || 'America/Lima';
const TIMEZONE_OFFSET = process.env.BUSINESS_TIMEZONE_OFFSET || '-05:00';

module.exports = {
  PORT: process.env.PORT || 3000,
  DEFAULT_SERVICES,
  BUSINESS_HOURS,
  SLOT_STEP_MINUTES,
  TIMEZONE,
  TIMEZONE_OFFSET,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
  GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || '',
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
};

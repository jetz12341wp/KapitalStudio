require('dotenv').config();

// Categorías de servicio de Barbería Skills. La duración define el tamaño
// del bloque que ocupa cada cita en la agenda.
const SERVICES = [
  { id: 'skills-premium', name: 'Skills Premium', duration: 60 },
  { id: 'hair-styling', name: 'Hair Styling', duration: 45 },
  { id: 'skin-care', name: 'Skin Care', duration: 30 },
  { id: 'nuevo-servicio', name: 'Nuevo Servicio', duration: 45 },
  { id: 'otros-servicios', name: 'Otros Servicios', duration: 30 },
];

// 0 = domingo ... 6 = sábado
const BUSINESS_HOURS = {
  0: { open: '10:00', close: '17:00' },
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
  SERVICES,
  BUSINESS_HOURS,
  SLOT_STEP_MINUTES,
  TIMEZONE,
  TIMEZONE_OFFSET,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
  GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || '',
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
};

module.exports.findService = function findService(id) {
  return SERVICES.find((s) => s.id === id);
};

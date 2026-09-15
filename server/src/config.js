require('dotenv').config();

// Servicios con los que arranca la base de datos la primera vez (solo semilla
// inicial). Una vez desplegado, el negocio los edita, borra o agrega los suyos
// desde /admin.html sin tocar este archivo.
const DEFAULT_SERVICES = [
  { id: 'skills-premium', name: 'Skills Premium', description: 'Cortes de autor y experiencia completa de barbería.', duration: 60 },
  { id: 'hair-styling', name: 'Hair Styling', description: 'Cortes clásicos, modernos y diseños a medida.', duration: 45 },
  { id: 'skin-care', name: 'Skin Care', description: 'Cuidado facial y de piel.', duration: 30 },
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

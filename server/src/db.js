const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'appointments.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id TEXT NOT NULL,
    date TEXT NOT NULL,          -- YYYY-MM-DD
    start_time TEXT NOT NULL,    -- HH:MM
    end_time TEXT NOT NULL,      -- HH:MM
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    notes TEXT,
    calendar_event_id TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);

  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Siembra inicial: solo la primera vez que se crea la base de datos (tabla vacía),
// así el negocio arranca con algo que funciona y luego lo reemplaza con sus
// servicios reales desde /admin.html sin tocar código.
const { DEFAULT_SERVICES } = require('./config');
const servicesCount = db.prepare('SELECT COUNT(*) AS n FROM services').get().n;
if (servicesCount === 0) {
  const insertDefault = db.prepare(
    `INSERT INTO services (id, name, description, duration, active, sort_order) VALUES (@id, @name, @description, @duration, 1, @sort_order)`
  );
  const seedMany = db.transaction((rows) => {
    rows.forEach((row, index) => insertDefault.run({ ...row, description: row.description || null, sort_order: index }));
  });
  seedMany(DEFAULT_SERVICES);
}

function getAppointmentsForDate(date) {
  return db
    .prepare(
      `SELECT * FROM appointments WHERE date = ? AND status != 'cancelled' ORDER BY start_time`
    )
    .all(date);
}

function insertAppointment(appt) {
  const stmt = db.prepare(`
    INSERT INTO appointments (service_id, date, start_time, end_time, name, phone, email, notes, calendar_event_id, status)
    VALUES (@service_id, @date, @start_time, @end_time, @name, @phone, @email, @notes, @calendar_event_id, @status)
  `);
  const info = stmt.run(appt);
  return info.lastInsertRowid;
}

function setCalendarEventId(id, calendarEventId) {
  db.prepare('UPDATE appointments SET calendar_event_id = ? WHERE id = ?').run(calendarEventId, id);
}

function listUpcomingAppointments() {
  return db
    .prepare(
      `SELECT * FROM appointments WHERE status != 'cancelled' AND date >= date('now', '-1 day') ORDER BY date, start_time`
    )
    .all();
}

function listActiveServices() {
  return db.prepare(`SELECT * FROM services WHERE active = 1 ORDER BY sort_order, name`).all();
}

function listAllServices() {
  return db.prepare(`SELECT * FROM services ORDER BY sort_order, name`).all();
}

function getService(id) {
  return db.prepare(`SELECT * FROM services WHERE id = ?`).get(id);
}

function getActiveService(id) {
  return db.prepare(`SELECT * FROM services WHERE id = ? AND active = 1`).get(id);
}

function createService({ id, name, description, duration }) {
  const maxOrder = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM services`).get().m;
  db.prepare(
    `INSERT INTO services (id, name, description, duration, active, sort_order) VALUES (?, ?, ?, ?, 1, ?)`
  ).run(id, name, description || null, duration, maxOrder + 1);
  return getService(id);
}

function updateService(id, { name, description, duration, active }) {
  const current = getService(id);
  if (!current) return null;
  db.prepare(
    `UPDATE services SET name = ?, description = ?, duration = ?, active = ? WHERE id = ?`
  ).run(
    name !== undefined ? name : current.name,
    description !== undefined ? description : current.description,
    duration !== undefined ? duration : current.duration,
    active !== undefined ? (active ? 1 : 0) : current.active,
    id
  );
  return getService(id);
}

function countAppointmentsForService(id) {
  return db.prepare(`SELECT COUNT(*) AS n FROM appointments WHERE service_id = ?`).get(id).n;
}

function deleteService(id) {
  db.prepare(`DELETE FROM services WHERE id = ?`).run(id);
}

module.exports = {
  db,
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
  countAppointmentsForService,
  deleteService,
};

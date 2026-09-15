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
`);

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

module.exports = {
  db,
  getAppointmentsForDate,
  insertAppointment,
  setCalendarEventId,
  listUpcomingAppointments,
};

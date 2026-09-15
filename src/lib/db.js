// Todas las funciones reciben `db` = env.DB (el binding de Cloudflare D1).
// D1 es SQLite, pero su API es asíncrona (prepare().bind().all()/first()/run()).

export async function getAppointmentsForDate(db, date) {
  const { results } = await db
    .prepare(`SELECT * FROM appointments WHERE date = ? AND status != 'cancelled' ORDER BY start_time`)
    .bind(date)
    .all();
  return results;
}

export async function insertAppointment(db, appt) {
  const res = await db
    .prepare(
      `INSERT INTO appointments (service_id, date, start_time, end_time, name, phone, email, notes, calendar_event_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      appt.service_id,
      appt.date,
      appt.start_time,
      appt.end_time,
      appt.name,
      appt.phone,
      appt.email,
      appt.notes,
      appt.calendar_event_id,
      appt.status
    )
    .run();
  return res.meta.last_row_id;
}

export async function setCalendarEventId(db, id, calendarEventId) {
  await db.prepare('UPDATE appointments SET calendar_event_id = ? WHERE id = ?').bind(calendarEventId, id).run();
}

export async function listUpcomingAppointments(db) {
  const { results } = await db
    .prepare(
      `SELECT * FROM appointments WHERE status != 'cancelled' AND date >= date('now', '-1 day') ORDER BY date, start_time`
    )
    .all();
  return results;
}

export async function listActiveServices(db) {
  const { results } = await db.prepare(`SELECT * FROM services WHERE active = 1 ORDER BY sort_order, name`).all();
  return results;
}

export async function listAllServices(db) {
  const { results } = await db.prepare(`SELECT * FROM services ORDER BY sort_order, name`).all();
  return results;
}

export async function getService(db, id) {
  return db.prepare(`SELECT * FROM services WHERE id = ?`).bind(id).first();
}

export async function getActiveService(db, id) {
  return db.prepare(`SELECT * FROM services WHERE id = ? AND active = 1`).bind(id).first();
}

export async function createService(db, { id, name, description, duration, price, priceIsFrom }) {
  const row = await db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM services`).first();
  const sortOrder = (row && row.m !== null ? row.m : -1) + 1;
  await db
    .prepare(
      `INSERT INTO services (id, name, description, duration, price, price_is_from, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .bind(id, name, description || null, duration, price === undefined ? null : price, priceIsFrom ? 1 : 0, sortOrder)
    .run();
  return getService(db, id);
}

export async function updateService(db, id, { name, description, duration, price, priceIsFrom, active }) {
  const current = await getService(db, id);
  if (!current) return null;
  await db
    .prepare(`UPDATE services SET name = ?, description = ?, duration = ?, price = ?, price_is_from = ?, active = ? WHERE id = ?`)
    .bind(
      name !== undefined ? name : current.name,
      description !== undefined ? description : current.description,
      duration !== undefined ? duration : current.duration,
      price !== undefined ? price : current.price,
      priceIsFrom !== undefined ? (priceIsFrom ? 1 : 0) : current.price_is_from,
      active !== undefined ? (active ? 1 : 0) : current.active,
      id
    )
    .run();
  return getService(db, id);
}

export async function countAppointmentsForService(db, id) {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM appointments WHERE service_id = ?`).bind(id).first();
  return row.n;
}

export async function deleteService(db, id) {
  await db.prepare(`DELETE FROM services WHERE id = ?`).bind(id).run();
}

CREATE TABLE IF NOT EXISTS citas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  hora TEXT NOT NULL,
  persona TEXT NOT NULL,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  servicio TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(fecha, hora, persona)
);

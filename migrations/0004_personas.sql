CREATE TABLE IF NOT EXISTS personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  almuerzo_inicio TEXT,
  almuerzo_fin TEXT,
  activa INTEGER NOT NULL DEFAULT 1,
  motivo_inactiva TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO personas (nombre, almuerzo_inicio, almuerzo_fin) VALUES
  ('Alejandro Galindo', '2:00 pm', '4:00 pm'),
  ('Niczon (Sensei)', '12:00 pm', '2:00 pm'),
  ('Lian Rojas', '1:00 pm', '3:00 pm');

CREATE TABLE IF NOT EXISTS indisponibilidad_personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  persona TEXT NOT NULL,
  fecha TEXT NOT NULL,
  hora TEXT NOT NULL DEFAULT '',
  motivo TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(persona, fecha, hora)
);

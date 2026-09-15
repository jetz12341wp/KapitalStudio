-- Semilla inicial de los 7 servicios reales de Kápital Studio. Las duraciones
-- son estimaciones razonables (no se especificaron); ajústalas desde
-- /admin.html si no coinciden con las reales. INSERT OR IGNORE para que
-- correr esta migración dos veces no falle ni duplique filas.
INSERT OR IGNORE INTO services (id, name, description, duration, price, price_is_from, active, sort_order) VALUES
  ('corte-clasico',      'Corte clásico',       'Corte tradicional a máquina y tijera.',      30, 25,  0, 1, 0),
  ('corte-degradado',    'Corte degradado',     'Fade / degradado a máquina.',                30, 30,  0, 1, 1),
  ('corte-a-tijera',     'Corte a tijera',      'Corte trabajado íntegramente a tijera.',     40, 30,  0, 1, 2),
  ('perfilado-de-barba', 'Perfilado de barba',  'Diseño y perfilado de barba.',                15, 15,  0, 1, 3),
  ('limpieza-facial',    'Limpieza facial',     'Limpieza facial profunda.',                   45, 50,  0, 1, 4),
  ('ondulacion',         'Ondulación',          'Ondulación permanente.',                      90, 100, 0, 1, 5),
  ('tinte',              'Tinte',               'Coloración de cabello.',                      60, 150, 1, 1, 6);

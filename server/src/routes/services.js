const express = require('express');
const {
  listActiveServices,
  listAllServices,
  getService,
  createService,
  updateService,
  deleteService,
  countAppointmentsForService,
} = require('../db');
const { uniqueSlug } = require('../slug');
const { requireAdmin } = require('../adminAuth');

const router = express.Router();

function validateDuration(duration) {
  const n = Number(duration);
  return Number.isInteger(n) && n > 0 && n <= 8 * 60;
}

// Público: lista de servicios activos, la que consume el formulario de reserva.
router.get('/services', (req, res) => {
  res.json(
    listActiveServices().map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      duration: s.duration,
    }))
  );
});

// A partir de aquí, endpoints de administración (requieren x-admin-token).
router.get('/admin/services', requireAdmin, (req, res) => {
  res.json(listAllServices());
});

router.post('/admin/services', requireAdmin, (req, res) => {
  const { name, description, duration } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  if (!validateDuration(duration)) {
    return res.status(400).json({ error: 'La duración debe ser un número de minutos entre 1 y 480.' });
  }
  const id = uniqueSlug(name, (candidate) => Boolean(getService(candidate)));
  const service = createService({ id, name: name.trim(), description: description ? description.trim() : null, duration: Number(duration) });
  res.status(201).json(service);
});

router.put('/admin/services/:id', requireAdmin, (req, res) => {
  const existing = getService(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Servicio no encontrado.' });

  const { name, description, duration, active } = req.body || {};
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'El nombre no puede quedar vacío.' });
  }
  if (duration !== undefined && !validateDuration(duration)) {
    return res.status(400).json({ error: 'La duración debe ser un número de minutos entre 1 y 480.' });
  }

  const updated = updateService(req.params.id, {
    name: name !== undefined ? name.trim() : undefined,
    description: description !== undefined ? (description ? description.trim() : null) : undefined,
    duration: duration !== undefined ? Number(duration) : undefined,
    active: active !== undefined ? Boolean(active) : undefined,
  });
  res.json(updated);
});

router.delete('/admin/services/:id', requireAdmin, (req, res) => {
  const existing = getService(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Servicio no encontrado.' });

  const appointmentsCount = countAppointmentsForService(req.params.id);
  if (appointmentsCount > 0) {
    // No se borra: hay citas (pasadas o futuras) que lo referencian. Se desactiva
    // para que no siga apareciendo en el formulario, sin romper el historial.
    const updated = updateService(req.params.id, { active: false });
    return res.json({ ...updated, deactivatedInstead: true });
  }

  deleteService(req.params.id);
  res.status(204).end();
});

module.exports = router;

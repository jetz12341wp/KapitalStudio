const { ADMIN_TOKEN } = require('./config');

// Protege una ruta admin: exige el header x-admin-token con el valor de ADMIN_TOKEN.
// Si ADMIN_TOKEN no está configurado, bloquea siempre (nunca se abre por defecto).
function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN || req.get('x-admin-token') !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  next();
}

module.exports = { requireAdmin };

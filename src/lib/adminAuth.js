import { json } from './http.js';

// Protege una ruta admin: exige el header x-admin-token con el valor de env.ADMIN_TOKEN.
// Si ADMIN_TOKEN no está configurado, bloquea siempre (nunca se abre por defecto).
export function isAdmin(request, env) {
  const token = request.headers.get('x-admin-token');
  return Boolean(env.ADMIN_TOKEN) && token === env.ADMIN_TOKEN;
}

export function unauthorized() {
  return json({ error: 'No autorizado.' }, 401);
}

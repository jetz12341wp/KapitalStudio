import { listActiveServices } from '../_lib/db.js';
import { serializePublic } from '../_lib/services.js';
import { json } from '../_lib/http.js';

// GET /api/services — servicios activos, la que consume el formulario público.
export async function onRequestGet({ env }) {
  const services = await listActiveServices(env.DB);
  return json(services.map(serializePublic));
}

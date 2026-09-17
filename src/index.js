const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORAS = ['10:00 am', '11:00 am', '12:00 pm', '1:00 pm', '2:00 pm', '3:00 pm', '4:00 pm', '5:00 pm', '6:00 pm', '7:00 pm', '8:00 pm'];

function parseHora(hora) {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(String(hora || '').trim());
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toLowerCase() === 'pm') h += 12;
  return h * 60 + parseInt(m[2], 10);
}

function horaEnAlmuerzo(hora, inicio, fin) {
  if (!inicio || !fin) return false;
  const h = parseHora(hora);
  const i = parseHora(inicio);
  const f = parseHora(fin);
  if (h === null || i === null || f === null) return false;
  return h >= i && h < f;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function isAuthorized(request, env) {
  return request.headers.get('x-admin-token') === env.ADMIN_TOKEN;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/admin/verificar' && request.method === 'GET') {
      return isAuthorized(request, env) ? jsonResponse({ ok: true }) : jsonResponse({ error: 'No autorizado' }, 401);
    }

    if (url.pathname === '/api/dias-bloqueados' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT fecha, motivo FROM dias_bloqueados ORDER BY fecha'
      ).all();
      return jsonResponse(results);
    }

    if (url.pathname === '/api/dias-bloqueados' && request.method === 'POST') {
      if (!isAuthorized(request, env)) return jsonResponse({ error: 'No autorizado' }, 401);
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'JSON inválido' }, 400);
      }
      if (!FECHA_RE.test(body.fecha)) return jsonResponse({ error: 'Fecha inválida (usa AAAA-MM-DD)' }, 400);
      await env.DB.prepare(
        'INSERT OR REPLACE INTO dias_bloqueados (fecha, motivo) VALUES (?, ?)'
      ).bind(body.fecha, body.motivo || null).run();
      return jsonResponse({ ok: true });
    }

    if (url.pathname.startsWith('/api/dias-bloqueados/') && request.method === 'DELETE') {
      if (!isAuthorized(request, env)) return jsonResponse({ error: 'No autorizado' }, 401);
      const fecha = decodeURIComponent(url.pathname.split('/').pop());
      if (!FECHA_RE.test(fecha)) return jsonResponse({ error: 'Fecha inválida' }, 400);
      await env.DB.prepare('DELETE FROM dias_bloqueados WHERE fecha = ?').bind(fecha).run();
      return jsonResponse({ ok: true });
    }

    if (url.pathname === '/api/citas' && request.method === 'GET') {
      const fecha = url.searchParams.get('fecha');
      if (!FECHA_RE.test(fecha)) return jsonResponse({ error: 'Fecha inválida (usa AAAA-MM-DD)' }, 400);
      const { results } = await env.DB.prepare(
        'SELECT hora, persona FROM citas WHERE fecha = ?'
      ).bind(fecha).all();
      return jsonResponse(results);
    }

    if (url.pathname === '/api/citas' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'JSON inválido' }, 400);
      }
      const { fecha, hora, persona, nombre, telefono, servicio } = body || {};
      if (!FECHA_RE.test(fecha)) return jsonResponse({ error: 'Fecha inválida' }, 400);
      if (!HORAS.includes(hora)) return jsonResponse({ error: 'Hora inválida' }, 400);
      if (!nombre || !telefono || !servicio) return jsonResponse({ error: 'Faltan datos del cliente' }, 400);

      const personaRow = await env.DB.prepare(
        'SELECT nombre, almuerzo_inicio, almuerzo_fin, activa, motivo_inactiva FROM personas WHERE nombre = ?'
      ).bind(persona).first();
      if (!personaRow) return jsonResponse({ error: 'Persona inválida' }, 400);
      if (!personaRow.activa) {
        return jsonResponse({ error: `${persona} no está recibiendo citas por el momento${personaRow.motivo_inactiva ? ': ' + personaRow.motivo_inactiva : ''}` }, 409);
      }
      if (horaEnAlmuerzo(hora, personaRow.almuerzo_inicio, personaRow.almuerzo_fin)) {
        return jsonResponse({ error: `${persona} está en su horario de almuerzo a esa hora` }, 409);
      }

      const { results: bloqueos } = await env.DB.prepare(
        "SELECT hora FROM indisponibilidad_personas WHERE persona = ? AND fecha = ? AND (hora = '' OR hora = ?)"
      ).bind(persona, fecha, hora).all();
      if (bloqueos.length) {
        return jsonResponse({ error: `${persona} no está disponible en esa fecha/hora` }, 409);
      }

      try {
        await env.DB.prepare(
          'INSERT INTO citas (fecha, hora, persona, nombre, telefono, servicio) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(fecha, hora, persona, nombre, telefono, servicio).run();
      } catch (err) {
        if (String(err.message || err).includes('UNIQUE')) {
          return jsonResponse({ error: 'Ese horario ya está ocupado' }, 409);
        }
        throw err;
      }
      return jsonResponse({ ok: true });
    }

    if (url.pathname === '/api/indisponibilidad' && request.method === 'GET') {
      const fecha = url.searchParams.get('fecha');
      if (!FECHA_RE.test(fecha)) return jsonResponse({ error: 'Fecha inválida (usa AAAA-MM-DD)' }, 400);
      const { results } = await env.DB.prepare(
        'SELECT persona, hora, motivo FROM indisponibilidad_personas WHERE fecha = ?'
      ).bind(fecha).all();
      return jsonResponse(results);
    }

    if (url.pathname === '/api/admin/indisponibilidad' && request.method === 'POST') {
      if (!isAuthorized(request, env)) return jsonResponse({ error: 'No autorizado' }, 401);
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'JSON inválido' }, 400);
      }
      const { persona, fecha, motivo } = body || {};
      const hora = body && body.hora ? body.hora : '';
      if (!FECHA_RE.test(fecha)) return jsonResponse({ error: 'Fecha inválida (usa AAAA-MM-DD)' }, 400);
      const personaRow = await env.DB.prepare('SELECT nombre FROM personas WHERE nombre = ?').bind(persona).first();
      if (!personaRow) return jsonResponse({ error: 'Persona inválida' }, 400);
      await env.DB.prepare(
        'INSERT OR REPLACE INTO indisponibilidad_personas (persona, fecha, hora, motivo) VALUES (?, ?, ?, ?)'
      ).bind(persona, fecha, hora, motivo || null).run();
      return jsonResponse({ ok: true });
    }

    if (url.pathname === '/api/admin/indisponibilidad' && request.method === 'DELETE') {
      if (!isAuthorized(request, env)) return jsonResponse({ error: 'No autorizado' }, 401);
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'JSON inválido' }, 400);
      }
      const { persona, fecha } = body || {};
      const hora = body && body.hora ? body.hora : '';
      if (!persona || !FECHA_RE.test(fecha)) return jsonResponse({ error: 'Faltan datos' }, 400);
      await env.DB.prepare(
        'DELETE FROM indisponibilidad_personas WHERE persona = ? AND fecha = ? AND hora = ?'
      ).bind(persona, fecha, hora).run();
      return jsonResponse({ ok: true });
    }

    if (url.pathname === '/api/personas' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT nombre, almuerzo_inicio, almuerzo_fin, activa, motivo_inactiva FROM personas ORDER BY id'
      ).all();
      return jsonResponse(results);
    }

    if (url.pathname === '/api/admin/personas' && request.method === 'POST') {
      if (!isAuthorized(request, env)) return jsonResponse({ error: 'No autorizado' }, 401);
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'JSON inválido' }, 400);
      }
      const nombre = body && body.nombre ? String(body.nombre).trim() : '';
      const almuerzoInicio = body && body.almuerzo_inicio ? body.almuerzo_inicio : null;
      const almuerzoFin = body && body.almuerzo_fin ? body.almuerzo_fin : null;
      if (!nombre) return jsonResponse({ error: 'Falta el nombre' }, 400);
      try {
        await env.DB.prepare(
          'INSERT INTO personas (nombre, almuerzo_inicio, almuerzo_fin) VALUES (?, ?, ?)'
        ).bind(nombre, almuerzoInicio, almuerzoFin).run();
      } catch (err) {
        if (String(err.message || err).includes('UNIQUE')) {
          return jsonResponse({ error: 'Ya existe una persona con ese nombre' }, 409);
        }
        throw err;
      }
      return jsonResponse({ ok: true });
    }

    if (url.pathname === '/api/admin/personas' && request.method === 'PATCH') {
      if (!isAuthorized(request, env)) return jsonResponse({ error: 'No autorizado' }, 401);
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'JSON inválido' }, 400);
      }
      const nombre = body && body.nombre;
      if (!nombre) return jsonResponse({ error: 'Falta el nombre' }, 400);
      const actual = await env.DB.prepare(
        'SELECT almuerzo_inicio, almuerzo_fin, activa, motivo_inactiva FROM personas WHERE nombre = ?'
      ).bind(nombre).first();
      if (!actual) return jsonResponse({ error: 'Persona no encontrada' }, 404);
      const almuerzoInicio = body.almuerzo_inicio !== undefined ? (body.almuerzo_inicio || null) : actual.almuerzo_inicio;
      const almuerzoFin = body.almuerzo_fin !== undefined ? (body.almuerzo_fin || null) : actual.almuerzo_fin;
      const activa = body.activa !== undefined ? (body.activa ? 1 : 0) : actual.activa;
      const motivoInactiva = body.motivo_inactiva !== undefined ? (body.motivo_inactiva || null) : actual.motivo_inactiva;
      await env.DB.prepare(
        'UPDATE personas SET almuerzo_inicio = ?, almuerzo_fin = ?, activa = ?, motivo_inactiva = ? WHERE nombre = ?'
      ).bind(almuerzoInicio, almuerzoFin, activa, motivoInactiva, nombre).run();
      return jsonResponse({ ok: true });
    }

    if (url.pathname === '/api/admin/personas' && request.method === 'DELETE') {
      if (!isAuthorized(request, env)) return jsonResponse({ error: 'No autorizado' }, 401);
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'JSON inválido' }, 400);
      }
      const nombre = body && body.nombre;
      if (!nombre) return jsonResponse({ error: 'Falta el nombre' }, 400);
      await env.DB.prepare('DELETE FROM personas WHERE nombre = ?').bind(nombre).run();
      return jsonResponse({ ok: true });
    }

    if (url.pathname === '/api/admin/citas' && request.method === 'GET') {
      if (!isAuthorized(request, env)) return jsonResponse({ error: 'No autorizado' }, 401);
      const fecha = url.searchParams.get('fecha');
      if (!FECHA_RE.test(fecha)) return jsonResponse({ error: 'Fecha inválida (usa AAAA-MM-DD)' }, 400);
      const { results } = await env.DB.prepare(
        'SELECT hora, persona, nombre, telefono, servicio FROM citas WHERE fecha = ? ORDER BY hora'
      ).bind(fecha).all();
      return jsonResponse(results);
    }

    if (url.pathname === '/api/admin/citas' && request.method === 'DELETE') {
      if (!isAuthorized(request, env)) return jsonResponse({ error: 'No autorizado' }, 401);
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'JSON inválido' }, 400);
      }
      const { fecha, hora, persona } = body || {};
      if (!FECHA_RE.test(fecha) || !hora || !persona) return jsonResponse({ error: 'Faltan datos' }, 400);
      await env.DB.prepare(
        'DELETE FROM citas WHERE fecha = ? AND hora = ? AND persona = ?'
      ).bind(fecha, hora, persona).run();
      return jsonResponse({ ok: true });
    }

    return env.ASSETS.fetch(request);
  },
};

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERSONAS = ['Alejandro Galindo', 'Niczon (Sensei)', 'Lian Rojas'];
const LUNCH_BREAKS = {
  'Alejandro Galindo': ['2:00 pm', '3:00 pm'],
  'Niczon (Sensei)': ['12:00 pm', '1:00 pm'],
  'Lian Rojas': ['1:00 pm', '2:00 pm'],
};

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
      if (!hora || typeof hora !== 'string') return jsonResponse({ error: 'Falta la hora' }, 400);
      if (!PERSONAS.includes(persona)) return jsonResponse({ error: 'Persona inválida' }, 400);
      if (!nombre || !telefono || !servicio) return jsonResponse({ error: 'Faltan datos del cliente' }, 400);

      if ((LUNCH_BREAKS[persona] || []).includes(hora)) {
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
      if (!PERSONAS.includes(persona)) return jsonResponse({ error: 'Persona inválida' }, 400);
      if (!FECHA_RE.test(fecha)) return jsonResponse({ error: 'Fecha inválida (usa AAAA-MM-DD)' }, 400);
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
      if (!PERSONAS.includes(persona) || !FECHA_RE.test(fecha)) return jsonResponse({ error: 'Faltan datos' }, 400);
      await env.DB.prepare(
        'DELETE FROM indisponibilidad_personas WHERE persona = ? AND fecha = ? AND hora = ?'
      ).bind(persona, fecha, hora).run();
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

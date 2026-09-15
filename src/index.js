const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

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

    return env.ASSETS.fetch(request);
  },
};

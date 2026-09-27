// ============================================================
//  db.js — Frontend API Client
// ============================================================

async function api(path, options = {}) {
  const url = `/api/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.error || err.mensaje_ejecucion || `Error ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const DB = {
  // --- Modelos ---
  getModelos: () => api('modelos'),
  crearModelo: (modelo) => api('modelos', { method: 'POST', body: JSON.stringify(modelo) }),
  actualizarModelo: (id, updates) => api(`modelos/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  desactivarModelo: (id) => api(`modelos/${id}`, { method: 'DELETE' }),

  // --- Historial ---
  getDiasMes: (mes) => api(`historial/${mes}`),
  getDia: (diaId) => api(`dia/${diaId}`),
  getLineasDia: (dia_id) => api(`historial/dia/${dia_id}`),
  getLineasFecha: (fecha) => api(`lineas-fecha/${fecha}`),
  previsualizarLineas: (items) => api('previsualizar-lineas', {
    method: 'POST',
    body: JSON.stringify({ items }),
  }),
  eliminarDia: (dia_id) => api(`historial/dia/${dia_id}`, { method: 'DELETE' }),
  limpiarMes: (mes) => api(`historial/limpiar/${mes}`, { method: 'POST' }),

  // --- Resumen ---
  getResumenMes: (mes) => api(`resumen/${mes}`),
  getRegistrosReporteMes: (mes) => api(`reportes/registros/${mes}`),
  enviarReporteMensual: (reporte) => api('reportes/mensual', {
    method: 'POST',
    body: JSON.stringify(reporte),
  }),
  
  // --- Guardar Día ---
  guardarDia: (fecha, items) => api('guardar-dia', {
      method: 'POST',
      body: JSON.stringify({ fecha, items }),
  }),
  
};

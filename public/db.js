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
    throw new Error(err.message || `Error ${res.status}`);
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
  eliminarDia: (dia_id) => api(`historial/dia/${dia_id}`, { method: 'DELETE' }),
  limpiarMes: (mes) => api(`historial/limpiar/${mes}`, { method: 'POST' }),

  // --- Resumen ---
  getLineasMes: (mes) => api(`resumen/${mes}`),
  
  // --- Guardar Día ---
  guardarDia: (fecha, items) => api('guardar-dia', {
      method: 'POST',
      body: JSON.stringify({ fecha, items }),
  }),
  
  // --- Cálculo Resumen (se mantiene en frontend) ---
  calcularResumen(lineas) {
    const porMaterial = { '3052K': 0, '3053F': 0, '3053E': 0 };
    const porModelo = {};

    for (const l of lineas) {
      const peso = l.peso_total != null
        ? parseFloat(l.peso_total)
        : (parseFloat(l.peso_unit) || 0) * (parseFloat(l.cantidad) || 0);
      const pt = Number.isFinite(peso) ? peso : 0;

      if (porMaterial[l.material] !== undefined) {
        porMaterial[l.material] += pt;
      }

      if (!porModelo[l.codigo]) {
        porModelo[l.codigo] = { material: l.material, cantidad: 0, peso: 0 };
      }
      porModelo[l.codigo].cantidad += Number(l.cantidad) || 0;
      porModelo[l.codigo].peso += pt;
    }

    const total = Object.values(porMaterial).reduce((s, v) => s + v, 0);
    return { porMaterial, porModelo, total };
  },
};

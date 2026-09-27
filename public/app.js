import { DB } from './db.js';
import { $, $$ } from './utils.js';

const TZ = 'America/Argentina/Buenos_Aires';

function getDateInTimezone(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    month: `${values.year}-${values.month}`,
  };
}

function formatDateForDisplay(dateString, options = {}) {
  const [year, month, day] = dateString.split('-').map(Number);
  // Use midday UTC to avoid timezone shifts that can show the previous day
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ,
    ...options,
  }).format(date);
}

// ============================================================
//  State & App
// ============================================================
const state = {
  modelos: [],
  lineas: [],
  currentDate: getDateInTimezone(new Date()).date,
  currentMes: getDateInTimezone(new Date()).month,
  editingModelo: null,
  filterMat: 'todos',
};

window.app = {
  // Page navigation
  showPage: (pageId) => {
    $$('.page').forEach(p => p.classList.remove('active'));
    $(`#page-${pageId}`).classList.add('active');
    $$('nav button').forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
    
    // Load data for the page
    const loadFunction = window.load[pageId];
    if (loadFunction) loadFunction();
  },
  
  // Add other global functions here
};

// ============================================================
//  Loaders (called on page show)
// ============================================================

window.load = {
  async carga() {
    const [lineas, modelos] = await Promise.all([
        DB.getLineasFecha(state.currentDate),
        DB.getModelos(),
    ]);

    state.lineas = lineas;
    state.modelos = modelos;

    renderCarga();
  },
  
  async historial() {
    actualizarMesLabels();
    const dias = await DB.getDiasMes(state.currentMes);
    renderHistorial(dias);
  },

  async resumen() {
    actualizarMesLabels();
    const resumen = await DB.getResumenMes(state.currentMes);
    renderResumen(resumen);
  },
  
  async modelos() {
    state.modelos = await DB.getModelos();
    renderModelos();
  },
};

// ============================================================
//  Render Functions
// ============================================================

function renderCarga() {
    const container = $('#page-carga');
    if (!state.modelos.length) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No hay modelos cargados.</p>
                <p>Andá a la sección "Modelos" para agregar uno.</p>
            </div>
        `;
        return;
    }

    // Format date for display
    const dateDisplay = formatDateForDisplay(state.currentDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Create a map of current entries indexed by modelo_id
    const lineasMap = new Map(state.lineas.map(l => [l.modelo_id, l]));

    container.innerHTML = `
        <div class="carga-header">
            <div class="fecha-display">
                <label for="current-date"><strong>Fecha:</strong></label>
                <input type="date" id="current-date" value="${state.currentDate}">
            </div>
        </div>
        
        <form id="form-carga" class="carga-form">
            <div class="input-group">
                <label for="modelo-select">Modelo</label>
                <select id="modelo-select" required>
                    <option value="">-- Seleccionar modelo --</option>
                    ${state.modelos.map(modelo => `
                        <option value="${modelo.id}" data-codigo="${modelo.codigo}" data-material="${modelo.material}" data-peso="${modelo.peso_unit}">
                            ${modelo.codigo} (${modelo.material})
                        </option>
                    `).join('')}
                </select>
            </div>
            
            <div class="input-group">
                <label for="cantidad-input">Cantidad</label>
                <input type="number" id="cantidad-input" inputmode="numeric" placeholder="Ingresar cantidad" min="1" required>
            </div>
            
            <button type="button" class="btn btn-primary" onclick="agregarLinea()">Agregar</button>
        </form>

        ${state.lineas.length > 0 ? `
            <div class="carga-tabla">
                <h3>Carga del día</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Modelo</th>
                            <th>Cantidad</th>
                          <th>Unitario (kg)</th>
                            <th>Peso (kg)</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.lineas.map((linea, idx) => {
                            const peso = Number(linea.peso_total) || 0;
                            return `
                            <tr>
                              <td class="carga-modelo">
                                <strong>${linea.codigo}</strong>
                                <small>${linea.material}</small>
                              </td>
                                <td>${linea.cantidad}</td>
                              <td>${Number(linea.peso_unit).toFixed(4)}</td>
                                <td>${peso.toFixed(2)}</td>
                                <td>
                                    <button type="button" class="btn btn-sm btn-danger" onclick="eliminarLinea(${idx})">
                                        <i class="ti ti-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                        }).join('')}
                    </tbody>
                </table>
                <div class="form-actions">
                    <button type="button" class="btn btn-primary" onclick="guardarCarga()">Guardar Carga</button>
                </div>
            </div>
        ` : ''}
    `;

    // Add event listeners
    $('#modelo-select').addEventListener('change', handleModeloSelect);
    // Date input change handler
    const dateInput = $('#current-date');
    if (dateInput) dateInput.addEventListener('change', handleDateChange);
    $('#cantidad-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') agregarLinea();
    });
}

function renderHistorial(dias) {
  const container = $('#lista-historial');
  if (!dias.length) {
    container.innerHTML = '<p class="empty-state">No hay registros para este mes.</p>';
    return;
  }
  container.innerHTML = dias.map(dia => `
    <div class="card-historial">
      <div class="historial-info">
        <strong>${formatDateForDisplay(dia.fecha, { weekday:'long', day:'numeric' })}</strong>
        <div class="historial-pesos">
          ${Object.entries(dia.porMaterial).map(([material, peso]) => `
            <span><b>${material}</b> ${Number(peso).toFixed(2)} kg</span>
          `).join('')}
          <span class="historial-total"><b>Total</b> ${Number(dia.total).toFixed(2)} kg</span>
        </div>
      </div>
      <div class="historial-actions">
        <button class="btn btn-sm" onclick="verDetalleDia('${dia.id}')">Ver</button>
        <button class="btn btn-sm btn-danger" onclick="eliminarDia('${dia.id}')"><i class="ti ti-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function renderResumen({ porMaterial, porModelo, porcentajeMaterial, total }) {
  
  // Metrics
  $('#metrics-total').innerHTML = `
    <div>
      <span>Peso total (kg)</span>
      <strong>${total.toFixed(2)}</strong>
    </div>
  `;
  
  // Bar chart
  $('#barras-material').innerHTML = Object.entries(porMaterial).map(([mat, val]) => `
    <div class="barra">
      <div class="barra-label">${mat}</div>
      <div class="barra-fill" style="width:${porcentajeMaterial[mat]}%"></div>
      <div class="barra-value">${val.toFixed(2)} kg</div>
    </div>
  `).join('');

  // Table
  $('#tabla-detalle').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Modelo</th>
          <th>Material</th>
          <th>Cantidad</th>
          <th>Peso (kg)</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(porModelo).map(([codigo, { material, cantidad, peso }]) => `
          <tr>
            <td>${codigo}</td>
            <td>${material}</td>
            <td>${cantidad}</td>
            <td>${peso.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderModelos() {
  const container = $('#lista-modelos');
  const filtered = state.filterMat === 'todos' 
    ? state.modelos 
    : state.modelos.filter(m => m.material === state.filterMat);

  if (!filtered.length) {
    container.innerHTML = '<p class="empty-state" style="padding: 20px 0">No hay modelos para este material.</p>';
    return;
  }

  container.innerHTML = filtered.map(m => `
    <div class="card-modelo">
      <div class="card-modelo-info">
        <strong>${m.codigo}</strong>
        <span>${m.material} - ${m.peso_unit} kg</span>
      </div>
      <div class="card-modelo-actions">
        <button class="btn btn-sm" onclick="abrirModalModelo('${m.id}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="eliminarModelo('${m.id}')"><i class="ti ti-trash"></i></button>
      </div>
    </div>
  `).join('');
}


// ============================================================
//  Event Handlers & Global Functions
// ============================================================

window.handleModeloSelect = (event) => {
    // Clear cantidad when modelo changes
    $('#cantidad-input').value = '';
    $('#cantidad-input').focus();
};

window.agregarLinea = async () => {
    const select = $('#modelo-select');
    const cantidadInput = $('#cantidad-input');
    
    if (!select.value || !cantidadInput.value) {
        showToast('Seleccioná un modelo e ingresá una cantidad', 'error');
        return;
    }
    
    const cantidad = parseInt(cantidadInput.value, 10);
    if (cantidad <= 0) {
        showToast('La cantidad debe ser mayor a 0', 'error');
        return;
    }
    
    const modeloId = select.value;
    const lineas = state.lineas.map(linea => ({ ...linea }));
    const existing = lineas.find(linea => linea.modelo_id === modeloId);
    if (existing) existing.cantidad += cantidad;
    else lineas.push({ modelo_id: modeloId, cantidad });

    try {
      state.lineas = await DB.previsualizarLineas(
        lineas.map(({ modelo_id, cantidad }) => ({ modelo_id, cantidad }))
      );
    } catch (err) {
      showToast('Error al calcular: ' + err.message, 'error');
      return;
    }
    
    // Clear form and re-render
    select.value = '';
    cantidadInput.value = '';
    renderCarga();
    select.focus();
};

window.eliminarLinea = (index) => {
    state.lineas.splice(index, 1);
    renderCarga();
};

window.guardarCarga = async () => {
    if (!state.lineas.length) {
        showToast('No hay líneas para guardar', 'error');
        return;
    }
    
    try {
        await DB.guardarDia(state.currentDate, state.lineas);
        showToast('Carga guardada correctamente');
        state.lineas = [];
        renderCarga();
    } catch (err) {
        showToast('Error al guardar: ' + err.message, 'error');
    }
};

async function handleDateChange(event) {
    const newDate = event.target.value;
    const oldDate = state.currentDate;
    
    // If date changed and there are unsaved lines
    if (newDate !== oldDate && state.lineas.length > 0) {
        showConfirm('¿Cambiar de fecha? Se perderán los cambios no guardados.', async () => {
            state.currentDate = newDate;
            state.lineas = [];
            await window.load.carga();
        });
        $('#current-date').value = oldDate; // revert visually until confirmed
        return;
    }
    
    state.currentDate = newDate;
    state.lineas = []; // Clear lines for new day
    await window.load.carga();
}

// --- General ---
window.showPage = app.showPage;
window.cerrarModal = () => $$('.modal-bg').forEach(m => m.style.display = 'none');

// ============================================================
//  Toast & Confirm helpers
// ============================================================

function showToast(msg, type = 'success') {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function showConfirm(mensaje, onOk) {
  const modal = $('#modal-confirm');
  $('#confirm-mensaje').textContent = mensaje;
  $('#confirm-titulo').textContent = '¿Estás seguro?';
  const btn = $('#confirm-ok-btn');
  // Clone to remove old listeners
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => {
    cerrarModal();
    onOk();
  });
  modal.style.display = 'flex';
}

window.abrirModalReporte = () => {
  actualizarMesLabels();
  $('#reporte-mes-text').textContent = `Se enviará el reporte de ${formatMesLabel(state.currentMes)}.`;
  $('#modal-reporte').style.display = 'flex';
};

window.enviarReporte = async () => {
  const email = $('#reporte-email').value.trim();
  const format = $('#reporte-formato').value;
  if (!email) return showToast('Ingresá el email del jefe', 'error');

  const button = $('#modal-reporte .btn-primary');
  button.disabled = true;
  button.textContent = 'Enviando...';
  try {
    const registros = await DB.getRegistrosReporteMes(state.currentMes);
    if (!registros.length) {
      throw new Error('El mes seleccionado no tiene registros para enviar.');
    }
    await DB.enviarReporteMensual({
      mes_reporte: formatMesLabel(state.currentMes),
      formato_salida: format,
      email_jefe: email,
      registros_diarios: registros,
    });
    cerrarModal();
    showToast(`Reporte de ${formatMesLabel(state.currentMes)} enviado`);
  } catch (error) {
    showToast('Error al enviar: ' + error.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Enviar';
  }
};



// --- Modelos Page ---
window.abrirModalModelo = (id) => {
  const modal = $('#modal-modelo');
  state.editingModelo = id ? state.modelos.find(m => m.id === id) : null;

  $('#modal-titulo').textContent = state.editingModelo ? 'Editar modelo' : 'Nuevo modelo';
  $('#m-codigo').value = state.editingModelo ? state.editingModelo.codigo : '';
  $('#m-peso').value = state.editingModelo ? state.editingModelo.peso_unit : '';
  
  const mat = state.editingModelo ? state.editingModelo.material : '3052K';
  $$('#m-mat-chips button').forEach(b => b.classList.toggle('active', b.dataset.mat === mat));

  modal.style.display = 'flex';
};

window.selMat = (btn) => {
  $$('#m-mat-chips button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

window.guardarModelo = async () => {
  const codigo = $('#m-codigo').value.toUpperCase();
  const peso_unit = parseFloat($('#m-peso').value);
  const material = $('#m-mat-chips .active').dataset.mat;

  if (!codigo || !peso_unit || !material) {
    return showToast('Completá todos los campos', 'error');
  }

  try {
    if (state.editingModelo) {
      await DB.actualizarModelo(state.editingModelo.id, { codigo, peso_unit, material });
    } else {
      await DB.crearModelo({ codigo, peso_unit, material });
    }
    cerrarModal();
    window.load.modelos(); // Refresh list
  } catch (err) {
    showToast('Error al guardar: ' + err.message, 'error');
  }
};

window.eliminarModelo = async (id) => {
  showConfirm('¿Seguro que querés eliminar este modelo? Esta acción no se puede deshacer.', async () => {
    try {
      await DB.desactivarModelo(id);
      showToast('Modelo eliminado');
      window.load.modelos();
    } catch (err) {
      showToast('Error al eliminar: ' + err.message, 'error');
    }
  });
};

window.filtrarMat = (mat, btn) => {
  state.filterMat = mat;
  $$('#chip-mat-filtro button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderModelos();
};

// --- Historial Page ---
window.confirmarResetMes = () => $('#modal-reset').style.display = 'flex';

window.resetMes = async () => {
  try {
    await DB.limpiarMes(state.currentMes);
    cerrarModal();
    window.load.historial(); // Refresh list
    window.load.resumen(); // Refresh summary too
  } catch (err) {
    showToast('Error al limpiar el mes: ' + err.message, 'error');
  }
};

window.verDetalleDia = async (diaId) => {
  const dia = await DB.getDia(diaId);
  if (dia) {
    state.currentDate = dia.fecha;
    app.showPage('carga');
  }
};

window.eliminarDia = async (diaId) => {
  showConfirm('¿Seguro que querés eliminar este día?', async () => {
    try {
      await DB.eliminarDia(diaId);
      showToast('Día eliminado');
      window.load.historial();
    } catch (err) {
      showToast('Error al eliminar: ' + err.message, 'error');
    }
  });
};

// Initial load
app.showPage('carga');

// ============================================================
//  Navegación de mes (Historial y Resumen)
// ============================================================

function formatMesLabel(mes) {
  const [year, month] = mes.split('-').map(Number);
  // Use midday UTC to avoid timezone edge cases when formatting month labels
  const date = new Date(Date.UTC(year, month - 1, 1, 12));
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ,
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function actualizarMesLabels() {
  const label = formatMesLabel(state.currentMes);
  const h = $('#historial-mes-label');
  const r = $('#resumen-mes-label');
  if (h) h.textContent = label;
  if (r) r.textContent = label;
}

window.cambiarMes = (delta) => {
  const [year, month] = state.currentMes.split('-').map(Number);
  const nueva = new Date(year, month - 1 + delta, 1);
  state.currentMes = `${nueva.getFullYear()}-${String(nueva.getMonth() + 1).padStart(2, '0')}`;
  actualizarMesLabels();

  // Refrescar la página activa
  const activePage = document.querySelector('.page.active')?.id?.replace('page-', '');
  if (activePage === 'historial') window.load.historial();
  if (activePage === 'resumen') window.load.resumen();
};
import express from 'express';
import {
  createModelo,
  deleteModelo,
  getDia,
  getHistorialMes,
  getLineasFecha,
  getLineasDia,
  getModelos,
  getResumenMes,
  getRegistrosReporteMes,
  generarReporte,
  guardarDia,
  limpiarMes,
  previsualizarLineas,
  removeDia,
  renderIndex,
  updateModelo,
} from '../controllers/appController.js';

const router = express.Router();

// --- Modelos ---
router.get('/api/modelos', getModelos);
router.post('/api/modelos', createModelo);
router.patch('/api/modelos/:id', updateModelo);
router.delete('/api/modelos/:id', deleteModelo);

// --- Historial ---
router.get('/api/historial/:mes', getHistorialMes);
router.get('/api/dia/:id', getDia);
router.get('/api/historial/dia/:id', getLineasDia);
router.get('/api/lineas-fecha/:fecha', getLineasFecha);
router.post('/api/previsualizar-lineas', previsualizarLineas);
router.delete('/api/historial/dia/:id', removeDia);
router.post('/api/historial/limpiar/:mes', limpiarMes);

// --- Resumen ---
router.get('/api/resumen/:mes', getResumenMes);
router.get('/api/reportes/registros/:mes', getRegistrosReporteMes);

// POST /api/guardar-dia
router.post('/api/guardar-dia', guardarDia);
router.post('/api/reportes/mensual', generarReporte);

// Frontend rendering
router.get('/', renderIndex);

export default router;

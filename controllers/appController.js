import db from '../db/db.js';
import { generateAndSendReport } from '../services/reportService.js';

export const getModelos = async (req, res) => {
  try {
    const modelos = await db.getModelos();
    res.json(modelos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createModelo = async (req, res) => {
  try {
    const nuevoModelo = await db.crearModelo(req.body);
    res.status(201).json(nuevoModelo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateModelo = async (req, res) => {
  try {
    const modeloActualizado = await db.actualizarModelo(req.params.id, req.body);
    res.json(modeloActualizado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteModelo = async (req, res) => {
  try {
    await db.desactivarModelo(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getHistorialMes = async (req, res) => {
  try {
    const dias = await db.getDiasMes(req.params.mes);
    res.json(dias);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDia = async (req, res) => {
  try {
    const dia = await db.getDia(req.params.id);
    res.json(dia);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getLineasDia = async (req, res) => {
  try {
    const lineas = await db.getLineasDia(req.params.id);
    res.json(lineas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getLineasFecha = async (req, res) => {
  try {
    const lineas = await db.getLineasFecha(req.params.fecha);
    res.json(lineas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const previsualizarLineas = async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Se requiere al menos una línea para calcular.' });
  }

  try {
    const lineas = await db.previsualizarLineas(items);
    res.json(lineas);
  } catch (error) {
    const esDatoInvalido = error.message.includes('cantidad')
      || error.message.includes('líneas repetidas')
      || error.message.includes('modelos ya no existen');
    res.status(esDatoInvalido ? 400 : 500).json({ error: error.message });
  }
};

export const removeDia = async (req, res) => {
  try {
    await db.eliminarDia(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const limpiarMes = async (req, res) => {
  try {
    const result = await db.limpiarMes(req.params.mes);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getResumenMes = async (req, res) => {
  try {
    const resumen = await db.getResumenMes(req.params.mes);
    res.json(resumen);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getRegistrosReporteMes = async (req, res) => {
  try {
    const registros = await db.getRegistrosReporteMes(req.params.mes);
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const guardarDia = async (req, res) => {
  const { fecha, items } = req.body;
  if (!fecha || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Missing required data.' });
  }

  try {
    const dia = await db.guardarDia(fecha, items);
    res.status(201).json(dia);
  } catch (error) {
    const esDatoInvalido = error.message.includes('cantidad')
      || error.message.includes('líneas repetidas')
      || error.message.includes('modelos ya no existen');
    res.status(esDatoInvalido ? 400 : 500).json({ error: error.message });
  }
};

export const renderIndex = (req, res) => {
  res.render('index');
};

export const generarReporte = async (req, res) => {
  try {
    const result = await generateAndSendReport(req.body);
    res.json(result);
  } catch (error) {
    const status = /SMTP|plantilla|obligatorio|debe ser|válido|Cada/.test(error.message) ? 400 : 500;
    res.status(status).json({
      status: 'error',
      archivos_generados: [],
      email_enviado_a: req.body?.email_jefe || '',
      mensaje_ejecucion: error.message,
    });
  }
};

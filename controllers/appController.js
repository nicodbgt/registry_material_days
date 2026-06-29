import db from '../db/db.js';

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
    const lineas = await db.getLineasMes(req.params.mes);
    res.json(lineas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const guardarDia = async (req, res) => {
  const { fecha, items } = req.body;
  if (!fecha || !items || !items.length) {
    return res.status(400).json({ error: 'Missing required data.' });
  }

  try {
    const dia = await db.guardarDia(fecha, items);
    res.status(201).json(dia);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save production day.' });
  }
};

export const renderIndex = (req, res) => {
  res.render('index');
};

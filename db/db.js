import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and Key are required. Check your .env file.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================>
//  Backend Database Logic
// ============================================================>

const db = {
  // ------------------------------------------------------------
  //  Modelos
  // ------------------------------------------------------------
  async getModelos() {
    const { data, error } = await supabase
      .from('modelos')
      .select('id,codigo,material,peso_unit')
      .eq('activo', true)
      .order('codigo', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
  },

  async crearModelo(modelo) {
    const { data, error } = await supabase
      .from('modelos')
      .insert(modelo)
      .select();
    if (error) throw new Error(error.message);
    return data[0];
  },

  async actualizarModelo(id, updates) {
    const { data, error } = await supabase
      .from('modelos')
      .update(updates)
      .eq('id', id)
      .select();
    if (error) throw new Error(error.message);
    return data[0];
  },

  async desactivarModelo(id) {
    const { error } = await supabase
      .from('modelos')
      .update({ activo: false })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return { id };
  },

  // ------------------------------------------------------------
  //  Producción (Días y Líneas)
  // ------------------------------------------------------------
  async getDiasMes(mes) {
    const [year, month] = mes.split('-').map(Number);
    const desde = `${mes}-01`;
    const ultimoDia = new Date(year, month, 0).getDate();
    const hasta = `${mes}-${String(ultimoDia).padStart(2, '0')}`;
    const { data, error } = await supabase
      .from('dias_produccion')
      .select('id, fecha, lineas_produccion(material, peso_total)')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(dia => {
      const porMaterial = { '3052K': 0, '3053F': 0, '3053E': 0 };
      for (const linea of dia.lineas_produccion) {
        porMaterial[linea.material] = (porMaterial[linea.material] || 0) + Number(linea.peso_total);
      }
      const total = Object.values(porMaterial).reduce((suma, peso) => suma + peso, 0);
      return { id: dia.id, fecha: dia.fecha, porMaterial, total };
    });
  },

  async getDia(diaId) {
    const { data, error } = await supabase
      .from('dias_produccion')
      .select('id, fecha')
      .eq('id', diaId)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async getLineasDia(dia_id) {
    const { data, error } = await supabase
      .from('lineas_produccion')
      .select('id,modelo_id,codigo,material,cantidad,peso_unit,peso_total')
      .eq('dia_id', dia_id)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
  },

  async getLineasFecha(fecha) {
    const { data: dia, error: diaError } = await supabase
      .from('dias_produccion')
      .select('id')
      .eq('fecha', fecha)
      .single();
    if (diaError && diaError.code !== 'PGRST116') throw new Error(diaError.message);
    if (!dia) return [];
    return this.getLineasDia(dia.id);
  },

  async eliminarDia(id) {
    const { error } = await supabase.from('dias_produccion').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { id };
  },

  async limpiarMes(mes) {
    // getDiasMes ya maneja errores internamente y devuelve el array directamente
    const dias = await db.getDiasMes(mes);
    const ids = dias.map(d => d.id);
    if (ids.length === 0) return { count: 0 };
    
    const { count, error: deleteError } = await supabase
        .from('dias_produccion')
        .delete({ count: 'exact' })
        .in('id', ids);
    
    if (deleteError) throw new Error(deleteError.message);
    return { count };
  },

  async previsualizarLineas(items) {
    const cantidadesPorModelo = new Map();
    for (const item of items) {
      if (!item.modelo_id || !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0) {
        throw new Error('Cada línea debe incluir un modelo válido y una cantidad entera mayor a cero.');
      }
      if (cantidadesPorModelo.has(item.modelo_id)) {
        throw new Error('No se permiten líneas repetidas para el mismo modelo.');
      }
      cantidadesPorModelo.set(item.modelo_id, item.cantidad);
    }

    const { data: modelos, error } = await supabase
      .from('modelos')
      .select('id,codigo,material,peso_unit')
      .in('id', [...cantidadesPorModelo.keys()])
      .eq('activo', true);
    if (error) throw new Error(error.message);
    if (modelos.length !== cantidadesPorModelo.size) {
      throw new Error('Uno o más modelos ya no existen o están inactivos.');
    }

    return modelos.map(modelo => {
      const cantidad = cantidadesPorModelo.get(modelo.id);
      const pesoUnitario = Number(modelo.peso_unit);
      return {
        modelo_id: modelo.id,
        codigo: modelo.codigo,
        material: modelo.material,
        peso_unit: pesoUnitario,
        cantidad,
        peso_total: Number((pesoUnitario * cantidad).toFixed(4)),
      };
    });
  },

  async guardarDia(fecha, items) {
    const cantidadesPorModelo = new Map();
    for (const item of items) {
      if (!item.modelo_id || !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0) {
        throw new Error('Cada línea debe incluir un modelo válido y una cantidad entera mayor a cero.');
      }
      if (cantidadesPorModelo.has(item.modelo_id)) {
        throw new Error('No se permiten líneas repetidas para el mismo modelo.');
      }
      cantidadesPorModelo.set(item.modelo_id, item.cantidad);
    }

    const { data: modelos, error: modelosError } = await supabase
      .from('modelos')
      .select('id,codigo,material,peso_unit')
      .in('id', [...cantidadesPorModelo.keys()])
      .eq('activo', true);
    if (modelosError) throw new Error(modelosError.message);
    if (modelos.length !== cantidadesPorModelo.size) {
      throw new Error('Uno o más modelos ya no existen o están inactivos.');
    }

    // Check if day exists, if so, delete its lines
    const { data: existingDay } = await supabase.from('dias_produccion').select('id').eq('fecha', fecha).single();
    let dia_id;

    if (existingDay) {
        dia_id = existingDay.id;
        await supabase.from('lineas_produccion').delete().eq('dia_id', dia_id);
    } else {
        const { data: newDay, error: dayError } = await supabase.from('dias_produccion').insert({ fecha }).select('id').single();
        if (dayError) throw new Error(dayError.message);
        dia_id = newDay.id;
    }

    // Insert new lines
    const lineas = modelos.map(modelo => ({
      dia_id,
      modelo_id: modelo.id,
      codigo: modelo.codigo,
      material: modelo.material,
      peso_unit: modelo.peso_unit,
      cantidad: cantidadesPorModelo.get(modelo.id),
    }));

    const { data, error } = await supabase.from('lineas_produccion').insert(lineas).select();
    if (error) throw new Error(error.message);
    return data;
  },
  
  // ------------------------------------------------------------
  //  Resumen
  // ------------------------------------------------------------
  async getResumenMes(mes) {
      const [year, month] = mes.split('-').map(Number);
      const desde = `${mes}-01`;
      const ultimoDia = new Date(year, month, 0).getDate();
      const hasta = `${mes}-${String(ultimoDia).padStart(2, '0')}`;

      const { data, error } = await supabase
          .from('dias_produccion')
          .select(`
              fecha,
              lineas_produccion(codigo, material, cantidad, peso_total)
          `)
          .gte('fecha', desde)
          .lte('fecha', hasta);

      if (error) throw new Error(error.message);

      const porMaterial = { '3052K': 0, '3053F': 0, '3053E': 0 };
      const porModelo = {};

      for (const dia of data) {
        for (const linea of dia.lineas_produccion) {
          const peso = Number(linea.peso_total);
          const cantidad = Number(linea.cantidad);
          if (!Number.isFinite(peso) || !Number.isFinite(cantidad)) continue;

          porMaterial[linea.material] = (porMaterial[linea.material] || 0) + peso;
          if (!porModelo[linea.codigo]) {
            porModelo[linea.codigo] = { material: linea.material, cantidad: 0, peso: 0 };
          }
          porModelo[linea.codigo].cantidad += cantidad;
          porModelo[linea.codigo].peso += peso;
        }
      }

      const total = Object.values(porMaterial).reduce((sum, peso) => sum + peso, 0);
      const porcentajeMaterial = Object.fromEntries(
        Object.entries(porMaterial).map(([material, peso]) => [
          material,
          total > 0 ? (peso / total) * 100 : 0,
        ])
      );

      return { porMaterial, porModelo, porcentajeMaterial, total };
  }
};

export default db;
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
      .select('id, fecha')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
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
      .select('id,codigo,material,cantidad,peso_total')
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

  async guardarDia(fecha, items) {
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
    const lineas = items.map(i => {
            // Debug: Verifica si algún elemento viene sin modelo_id
      if (!i.modelo_id) {
        console.error("DATO INVÁLIDO DETECTADO:", i);
        throw new Error(`El ítem con código ${i.codigo} no tiene modelo_id.`);
      }

    return {
      dia_id,
      modelo_id: i.modelo_id,
      codigo:    i.codigo,
      material:  i.material,
      peso_unit: i.peso_unit,
      cantidad:  i.cantidad,
      // peso_total: i.peso_total ?? (parseFloat(i.peso_unit) || 0) * (parseFloat(i.cantidad) || 0),
    }});

    const { data, error } = await supabase.from('lineas_produccion').insert(lineas).select();
    if (error) throw new Error(error.message);
    return data;
  },
  
  // ------------------------------------------------------------
  //  Resumen
  // ------------------------------------------------------------
  async getLineasMes(mes) {
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

      // Flatten the result
      return data.flatMap(dia => dia.lineas_produccion.map(linea => ({ ...linea, fecha: dia.fecha })));
  }
};

export default db;
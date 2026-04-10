import { getSupabase } from '../lib/supabase';
import { Pieza, RegistroPeso, ConfigCorte, EstadoPieza, TipoEvento, Usuario, RolUsuario } from '../types';

const getClient = () => {
  const client = getSupabase();
  if (!client) throw new Error('Supabase not configured');
  return client;
};

export const supabaseService = {
  // Config Cortes
  async fetchConfigCortes(): Promise<ConfigCorte[]> {
    const { data, error } = await getClient()
      .from('config_cortes')
      .select('*')
      .order('nombre');
    
    if (error) throw error;
    
    return (data || []).map(c => ({
      id: c.id,
      nombre: c.nombre,
      mermaDescongeladoMax: Number(c.merma_descongelado_max),
      mermaTotalMax: Number(c.merma_total_max)
    }));
  },

  async saveConfigCorte(corte: ConfigCorte) {
    const { error } = await getClient()
      .from('config_cortes')
      .upsert({
        id: corte.id.startsWith('C-') ? undefined : corte.id, // Let Supabase generate UUID if it's a temp ID
        nombre: corte.nombre,
        merma_descongelado_max: corte.mermaDescongeladoMax,
        merma_total_max: corte.mermaTotalMax
      });
    if (error) throw error;
  },

  async deleteConfigCorte(id: string) {
    const { error } = await getClient()
      .from('config_cortes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Piezas
  async fetchPiezas(): Promise<Pieza[]> {
    const { data, error } = await getClient()
      .from('piezas')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(p => ({
      id: p.id,
      tipo: p.tipo,
      estado: p.estado as EstadoPieza,
      pesoCongelado: Number(p.peso_congelado),
      pesoDescongelado: Number(p.peso_descongelado),
      pesoProducido: Number(p.peso_producido),
      mermaDescongelado: Number(p.merma_descongelado),
      mermaTotal: Number(p.merma_total),
      merma: Number(p.merma),
      rendimiento: Number(p.rendimiento),
      porciones: p.porciones,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));
  },

  async createPieza(pieza: Pieza) {
    const { error } = await getClient()
      .from('piezas')
      .insert({
        id: pieza.id,
        tipo: pieza.tipo,
        estado: pieza.estado,
        peso_congelado: pieza.pesoCongelado,
        peso_descongelado: pieza.pesoDescongelado,
        peso_producido: pieza.pesoProducido,
        merma_descongelado: pieza.mermaDescongelado,
        merma_total: pieza.mermaTotal,
        merma: pieza.merma,
        rendimiento: pieza.rendimiento,
        porciones: pieza.porciones,
        created_at: pieza.createdAt,
        updated_at: pieza.updatedAt
      });
    if (error) throw error;
  },

  async updatePieza(pieza: Partial<Pieza> & { id: string }) {
    const { error } = await getClient()
      .from('piezas')
      .update({
        estado: pieza.estado,
        peso_congelado: pieza.pesoCongelado,
        peso_descongelado: pieza.pesoDescongelado,
        peso_producido: pieza.pesoProducido,
        merma_descongelado: pieza.mermaDescongelado,
        merma_total: pieza.mermaTotal,
        merma: pieza.merma,
        rendimiento: pieza.rendimiento,
        porciones: pieza.porciones,
        updated_at: new Date().toISOString()
      })
      .eq('id', pieza.id);
    if (error) throw error;
  },

  // Registros
  async uploadImage(base64Data: string, fileName: string): Promise<string> {
    const client = getClient();
    
    // Convert base64 to Blob
    const base64Response = await fetch(base64Data);
    const blob = await base64Response.blob();

    const { data, error } = await client
      .storage
      .from('evidencias')
      .upload(`${fileName}.jpg`, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) throw error;

    // Get Public URL
    const { data: { publicUrl } } = client
      .storage
      .from('evidencias')
      .getPublicUrl(data.path);

    return publicUrl;
  },

  async fetchRegistros(): Promise<RegistroPeso[]> {
    const { data, error } = await getClient()
      .from('registros_peso')
      .select('*')
      .order('fecha', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(r => ({
      id: r.id,
      piezaId: r.pieza_id,
      tipoEvento: r.tipo_evento as TipoEvento,
      peso: Number(r.peso),
      foto: r.foto_url,
      usuario: r.usuario_nombre,
      validadoIA: r.validado_ia,
      iaDetectedWeight: r.ia_detected_weight,
      iaReason: r.ia_reason,
      fecha: r.fecha
    }));
  },

  async createRegistro(reg: RegistroPeso) {
    const { error } = await getClient()
      .from('registros_peso')
      .insert({
        pieza_id: reg.piezaId,
        tipo_evento: reg.tipoEvento,
        peso: reg.peso,
        foto_url: reg.foto,
        usuario_nombre: reg.usuario,
        validado_ia: reg.validadoIA,
        ia_detected_weight: reg.iaDetectedWeight,
        ia_reason: reg.iaReason,
        fecha: reg.fecha
      });
    if (error) throw error;
  },

  // Perfiles
  async fetchProfile(userId: string): Promise<Usuario | null> {
    const { data, error } = await getClient()
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) return null;
    
    return {
      id: data.id,
      nombre: data.nombre_completo || data.email.split('@')[0],
      rol: data.rol === 'admin' ? RolUsuario.ADMIN : RolUsuario.COCINA
    };
  }
};

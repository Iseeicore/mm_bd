import { Normalizador } from './normalizador.js';

export class TrazabilidadNormalizador extends Normalizador {
  normalizar() {
    const {
      tipo, producto_public_id, producto_nombre,
      ubicacion_tipo, ubicacion_public_id, ubicacion_nombre,
      cantidad, fecha_creacion, motivo,
    } = this.fila;
    return {
      tipo, producto_public_id, producto_nombre,
      ubicacion_tipo, ubicacion_public_id, ubicacion_nombre,
      cantidad, fecha_creacion, motivo,
    };
  }
}

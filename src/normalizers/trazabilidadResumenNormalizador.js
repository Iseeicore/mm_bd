import { Normalizador } from './normalizador.js';

export class TrazabilidadResumenNormalizador extends Normalizador {
  normalizar() {
    const {
      producto_public_id, producto_nombre,
      ubicacion_tipo, ubicacion_public_id, ubicacion_nombre,
      cantidad_total,
    } = this.fila;
    return {
      producto_public_id, producto_nombre,
      ubicacion_tipo, ubicacion_public_id, ubicacion_nombre,
      cantidad_total,
    };
  }
}

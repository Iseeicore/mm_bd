import { Normalizador } from './normalizador.js';

export class MovimientoNormalizador extends Normalizador {
  normalizar() {
    const {
      public_id, tipo, cantidad, motivo, fecha_creacion,
      producto_public_id, producto_nombre,
      ubicacion_tipo, ubicacion_public_id, ubicacion_nombre,
      ubicacion_destino_tipo, ubicacion_destino_public_id, ubicacion_destino_nombre,
      creado_por_nombre,
    } = this.fila;
    return {
      public_id, tipo, cantidad, motivo, fecha_creacion,
      producto_public_id, producto_nombre,
      ubicacion_tipo, ubicacion_public_id, ubicacion_nombre,
      ubicacion_destino_tipo, ubicacion_destino_public_id, ubicacion_destino_nombre,
      creado_por_nombre,
    };
  }
}

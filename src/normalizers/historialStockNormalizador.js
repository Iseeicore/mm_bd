import { Normalizador } from './normalizador.js';

export class HistorialStockNormalizador extends Normalizador {
  normalizar() {
    const { tipo, ubicacion_tipo, ubicacion_public_id, ubicacion_nombre, cantidad, fecha_creacion, motivo } = this.fila;
    return { tipo, ubicacion_tipo, ubicacion_public_id, ubicacion_nombre, cantidad, fecha_creacion, motivo };
  }
}

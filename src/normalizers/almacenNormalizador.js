import { Normalizador } from './normalizador.js';

export class AlmacenNormalizador extends Normalizador {
  normalizar() {
    const { public_id, nombre, ubicacion, empresa_id, activo, fecha_creacion, fecha_modificacion } = this.fila;
    return { public_id, nombre, ubicacion, empresa_id, activo, fecha_creacion, fecha_modificacion };
  }
}

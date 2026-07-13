import { Normalizador } from './normalizador.js';

export class VentaNormalizador extends Normalizador {
  normalizar() {
    const { public_id, tienda_public_id, tienda_nombre, total, fecha_creacion, creado_por_nombre } = this.fila;
    return { public_id, tienda_public_id, tienda_nombre, total, fecha_creacion, creado_por_nombre };
  }
}

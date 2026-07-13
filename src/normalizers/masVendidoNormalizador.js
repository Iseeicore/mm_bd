import { Normalizador } from './normalizador.js';

export class MasVendidoNormalizador extends Normalizador {
  normalizar() {
    const { producto_public_id, producto_nombre, cantidad_vendida, total_vendido } = this.fila;
    return { producto_public_id, producto_nombre, cantidad_vendida, total_vendido };
  }
}

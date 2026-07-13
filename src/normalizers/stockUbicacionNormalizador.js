import { Normalizador } from './normalizador.js';

// Una fila de stock de un producto en un almacén o en una tienda. El public_id
// y nombre acá son los de la ubicación (almacén/tienda), no los del producto
// — S_producto_almacen/S_producto_tienda no tienen public_id propio.
export class StockUbicacionNormalizador extends Normalizador {
  normalizar() {
    const { public_id, nombre, stock_actual, stock_minimo, fecha_actualizacion } = this.fila;
    return { public_id, nombre, stock_actual, stock_minimo, fecha_actualizacion };
  }
}

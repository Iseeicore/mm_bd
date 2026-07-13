import { Normalizador } from './normalizador.js';

// Fila de un producto con su stock en UNA ubicacion (almacen o tienda) --
// espejo de StockUbicacionNormalizador, que expone la ubicacion en vez del
// producto.
//
// stock_actual esta trackeado en UNIDADES SUELTAS, siempre (ver
// movimiento.js/venta.js: cantidad se suma/resta directo contra stock_actual,
// sin conversion por unidades_por_paquete en ningun lado). paquetes_completos
// es un derivado de presentacion (stock_actual / unidades_por_paquete,
// division entera de Postgres) calculado en la query, no un valor guardado.
export class ProductoStockNormalizador extends Normalizador {
  normalizar() {
    const {
      producto_public_id, producto_nombre,
      precio_venta_unidad, precio_venta_paquete, unidades_por_paquete,
      stock_actual, paquetes_completos, stock_minimo, fecha_actualizacion,
    } = this.fila;
    return {
      producto_public_id, producto_nombre,
      precio_venta_unidad, precio_venta_paquete, unidades_por_paquete,
      stock_actual, paquetes_completos, stock_minimo, fecha_actualizacion,
    };
  }
}

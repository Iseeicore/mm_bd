import { Normalizador } from './normalizador.js';

// Una linea de venta ya resuelta -- origen_public_id/origen_nombre son los
// del almacen o tienda elegido por el cajero para ESA linea (ver design doc,
// regla de interaccion de frontend), no de la tienda-cabecera de la venta.
export class VentaDetalleNormalizador extends Normalizador {
  normalizar() {
    const {
      producto_public_id, producto_nombre, cantidad, precio_unitario, subtotal,
      origen_tipo, origen_public_id, origen_nombre,
    } = this.fila;
    return {
      producto_public_id, producto_nombre, cantidad, precio_unitario, subtotal,
      origen_tipo, origen_public_id, origen_nombre,
    };
  }
}

import { Normalizador } from './normalizador.js';

export class HistorialPrecioNormalizador extends Normalizador {
  normalizar() {
    const {
      precio_compra_paquete_anterior, precio_compra_paquete_nuevo,
      precio_venta_unidad_anterior, precio_venta_unidad_nuevo,
      precio_venta_paquete_anterior, precio_venta_paquete_nuevo,
      fecha_cambio, modificado_por_nombre,
    } = this.fila;
    return {
      precio_compra_paquete_anterior, precio_compra_paquete_nuevo,
      precio_venta_unidad_anterior, precio_venta_unidad_nuevo,
      precio_venta_paquete_anterior, precio_venta_paquete_nuevo,
      fecha_cambio, modificado_por_nombre,
    };
  }
}

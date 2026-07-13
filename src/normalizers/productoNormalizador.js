import { Normalizador } from './normalizador.js';

export class ProductoNormalizador extends Normalizador {
  normalizar() {
    const {
      public_id, codigo_barras, nombre, descripcion, unidades_por_paquete,
      precio_compra_paquete, precio_venta_unidad, precio_venta_paquete,
      empresa_id, activo, fecha_creacion, fecha_modificacion,
    } = this.fila;
    return {
      public_id, codigo_barras, nombre, descripcion, unidades_por_paquete,
      precio_compra_paquete, precio_venta_unidad, precio_venta_paquete,
      empresa_id, activo, fecha_creacion, fecha_modificacion,
    };
  }
}

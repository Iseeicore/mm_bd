export class Normalizador {
  constructor(fila) {
    this.fila = fila;
  }

  normalizar() {
    throw new Error(`${this.constructor.name} debe implementar normalizar()`);
  }

  static normalizarLista(filas) {
    return filas.map((fila) => new this(fila).normalizar());
  }
}

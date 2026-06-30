class TiempoZona {
  #convertir(fecha, timeZone) {
    return new Intl.DateTimeFormat('es-PE', {
      timeZone,
      year:   'numeric',
      month:  '2-digit',
      day:    '2-digit',
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(fecha instanceof Date ? fecha : new Date(fecha));
  }

  peru(fecha) {
    return this.#convertir(fecha, 'America/Lima');
  }
}

export default new TiempoZona();

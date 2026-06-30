export const paginar = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit, offset: (page - 1) * limit };
};

export const respuestaPaginada = (rows, page, limit) => {
  const total = rows.length ? parseInt(rows[0]._total) : 0;
  const data  = rows.map(({ _total, ...rest }) => rest);
  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
};

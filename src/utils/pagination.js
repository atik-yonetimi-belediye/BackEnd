function getPagination(input = {}) {
  const page = Number(input.page) || 1;
  const limit = Number(input.limit) || 50;
  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function toPaginatedResult(rows, page, limit) {
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map((row) => {
    const item = { ...row };
    delete item.total_count;
    return item;
  });

  return {
    __paginated: true,
    items,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

module.exports = {
  getPagination,
  toPaginatedResult,
};

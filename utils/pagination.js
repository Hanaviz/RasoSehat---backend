// Simple pagination helper
function parsePagination(req) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(100, Math.max(5, Number(req.query.per_page || req.query.perPage) || 20));
  const offset = (page - 1) * perPage;
  return { page, perPage, offset, from: offset, to: offset + perPage - 1 };
}

function formatPagination(total, page, perPage) {
  const totalPages = perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1;
  return { page, per_page: perPage, total, total_pages: totalPages };
}

module.exports = { parsePagination, formatPagination };

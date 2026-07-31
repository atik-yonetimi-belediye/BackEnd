const pool = require("../../config/db");
const {
  getPagination,
  toPaginatedResult,
} = require("../../utils/pagination");

async function getAllMahalleler(pagination = {}) {
  const { page, limit, offset } = getPagination(pagination);
  const result = await pool.query(
    `
    SELECT id, ad, ilce, il, created_at, updated_at,
           COUNT(*) OVER() AS total_count
    FROM mahalleler
    ORDER BY ad ASC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );
  return toPaginatedResult(result.rows, page, limit);
}

async function getMahalleById(id) {
  const result = await pool.query(
    `
    SELECT id, ad, ilce, il, created_at, updated_at
    FROM mahalleler
    WHERE id = $1
    `,
    [id]
  );
  return result.rows[0];
}

module.exports = {
  getAllMahalleler,
  getMahalleById,
};

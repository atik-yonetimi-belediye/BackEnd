const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getPagination,
  toPaginatedResult,
} = require("../../src/utils/pagination");

test("sayfa ve limit değerlerinden doğru offset üretir", () => {
  assert.deepEqual(getPagination({ page: 3, limit: 25 }), {
    page: 3,
    limit: 25,
    offset: 50,
  });
});

test("SQL toplam alanını sonuçlardan ayırarak meta verisine taşır", () => {
  const result = toPaginatedResult(
    [
      { id: 1, total_count: "51" },
      { id: 2, total_count: "51" },
    ],
    2,
    20
  );

  assert.deepEqual(result.items, [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(result.pagination, {
    page: 2,
    limit: 20,
    total: 51,
    total_pages: 3,
  });
});

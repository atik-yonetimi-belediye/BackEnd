const pool = require("../config/db");
const AppError = require("../utils/AppError");
const { recordActivity } = require("./activity.service");

async function assertAccountExists(queryable, accountType, accountId) {
  const table = accountType === "cavus" ? "cavuslar" : accountType === "sofor" ? "soforler" : null;
  if (!table) throw new AppError("Desteklenmeyen personel türü.", 400);
  const result = await queryable.query(`SELECT id FROM ${table} WHERE id = $1`, [accountId]);
  if (!result.rowCount) throw new AppError("Personel bulunamadı.", 404);
}

async function getEffectivePermissions(accountType, accountId, queryable = pool) {
  if (accountType === "admin") return ["*"];
  if (!["cavus", "sofor"].includes(accountType)) return [];
  const result = await queryable.query(
    `SELECT d.code, COALESCE(o.allowed, r.enabled, d.default_enabled) AS allowed
       FROM permission_definitions d
       LEFT JOIN role_permission_defaults r
         ON r.permission_code = d.code AND r.account_type = d.account_type
       LEFT JOIN user_permission_overrides o
         ON o.permission_code = d.code
        AND o.account_type = d.account_type
        AND o.account_id = $2
      WHERE d.account_type = $1
      ORDER BY d.sort_order, d.code`,
    [accountType, accountId]
  );
  return result.rows.filter((item) => item.allowed).map((item) => item.code);
}

async function hasPermission(accountType, accountId, code, queryable = pool) {
  if (accountType === "admin") return true;
  const result = await queryable.query(
    `SELECT COALESCE(o.allowed, r.enabled, d.default_enabled) AS allowed
       FROM permission_definitions d
       LEFT JOIN role_permission_defaults r
         ON r.permission_code = d.code AND r.account_type = d.account_type
       LEFT JOIN user_permission_overrides o
         ON o.permission_code = d.code
        AND o.account_type = d.account_type
        AND o.account_id = $2
      WHERE d.account_type = $1 AND d.code = $3`,
    [accountType, accountId, code]
  );
  return Boolean(result.rows[0]?.allowed);
}

async function getCatalog(accountType, accountId) {
  await assertAccountExists(pool, accountType, accountId);
  const result = await pool.query(
    `SELECT d.code, d.label, d.description, d.category,
            COALESCE(r.enabled, d.default_enabled) AS default_enabled,
            d.risk_level, d.sort_order, o.allowed AS override_value,
            COALESCE(o.allowed, r.enabled, d.default_enabled) AS effective_value,
            COALESCE(v.version, 1)::bigint AS permission_version,
            COALESCE(v.updated_at, CURRENT_TIMESTAMP) AS permission_updated_at
       FROM permission_definitions d
       LEFT JOIN role_permission_defaults r
         ON r.permission_code = d.code AND r.account_type = d.account_type
       LEFT JOIN user_permission_overrides o
         ON o.permission_code = d.code
        AND o.account_type = d.account_type
        AND o.account_id = $2
       LEFT JOIN user_permission_versions v
         ON v.account_type = d.account_type AND v.account_id = $2
      WHERE d.account_type = $1
      ORDER BY d.category, d.sort_order, d.code`,
    [accountType, accountId]
  );
  return result.rows;
}

async function updatePermissions(adminId, accountType, accountId, permissions) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertAccountExists(client, accountType, accountId);
    const definitions = await client.query(
      `SELECT d.code, COALESCE(r.enabled, d.default_enabled) AS default_enabled
         FROM permission_definitions d
         LEFT JOIN role_permission_defaults r
           ON r.permission_code=d.code AND r.account_type=d.account_type
        WHERE d.account_type = $1`,
      [accountType]
    );
    const definitionMap = new Map(definitions.rows.map((item) => [item.code, item.default_enabled]));
    for (const item of permissions) {
      if (!definitionMap.has(item.code)) throw new AppError(`Geçersiz yetki: ${item.code}`, 400);
      const previous = await hasPermission(accountType, accountId, item.code, client);
      if (item.allowed === null || item.allowed === definitionMap.get(item.code)) {
        await client.query(
          "DELETE FROM user_permission_overrides WHERE account_type = $1 AND account_id = $2 AND permission_code = $3",
          [accountType, accountId, item.code]
        );
      } else {
        await client.query(
          `INSERT INTO user_permission_overrides
             (account_type, account_id, permission_code, allowed, changed_by_admin_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (account_type, account_id, permission_code)
           DO UPDATE SET allowed = EXCLUDED.allowed, changed_by_admin_id = EXCLUDED.changed_by_admin_id,
                         updated_at = CURRENT_TIMESTAMP`,
          [accountType, accountId, item.code, item.allowed, adminId]
        );
      }
      const current = item.allowed === null ? definitionMap.get(item.code) : item.allowed;
      if (previous !== current) {
        await client.query(
          `INSERT INTO permission_change_history
             (account_type, account_id, permission_code, previous_value, new_value, changed_by_admin_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [accountType, accountId, item.code, previous, current, adminId]
        );
      }
    }
    await client.query(
      `INSERT INTO user_permission_versions (account_type, account_id, version)
       VALUES ($1, $2, 2)
       ON CONFLICT (account_type, account_id)
       DO UPDATE SET version = user_permission_versions.version + 1,
                     updated_at = CURRENT_TIMESTAMP`,
      [accountType, accountId]
    );
    const admin = await client.query("SELECT ad_soyad FROM yoneticiler WHERE id = $1", [adminId]);
    await recordActivity(client, {
      actorRole: "admin", actorId: adminId, actorName: admin.rows[0]?.ad_soyad || "Yönetici",
      entityType: accountType, entityId: Number(accountId), action: "permissions.updated",
      summary: `${permissions.length} yetki tercihi güncellendi.`,
      metadata: { permission_codes: permissions.map((item) => item.code) },
    });
    await client.query("COMMIT");
    return getCatalog(accountType, accountId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resetPermissions(adminId, accountType, accountId) {
  const catalog = await getCatalog(accountType, accountId);
  return updatePermissions(adminId, accountType, accountId, catalog.map((item) => ({ code: item.code, allowed: null })));
}

module.exports = { getEffectivePermissions, hasPermission, getCatalog, updatePermissions, resetPermissions };

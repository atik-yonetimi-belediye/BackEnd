const permissionService = require("../../services/permission.service");
const activityService = require("../../services/activity.service");
const pool = require("../../config/db");
const { successResponse, errorResponse } = require("../../utils/response");

const handle = (work) => async (req, res) => {
  try { return await work(req, res); }
  catch (error) { return errorResponse(res, error.message, error.statusCode || 500, error.errors); }
};

const getPermissions = handle(async (req, res) => successResponse(
  res,
  "Personel yetkileri getirildi.",
  await permissionService.getCatalog(req.params.accountType, req.params.id)
));

const updatePermissions = handle(async (req, res) => successResponse(
  res,
  "Personel yetkileri güncellendi.",
  await permissionService.updatePermissions(req.user.id, req.params.accountType, req.params.id, req.body.permissions)
));

const resetPermissions = handle(async (req, res) => successResponse(
  res,
  "Personel yetkileri varsayılana döndürüldü.",
  await permissionService.resetPermissions(req.user.id, req.params.accountType, req.params.id)
));

const getPersonTimeline = handle(async (req, res) => {
  const [events, audit] = await Promise.all([
    activityService.getTimeline(req.params.accountType, req.params.id),
    pool.query(
      `SELECT a.id, a.action, a.entity_path, a.created_at, y.ad_soyad AS actor_name
         FROM audit_logs a LEFT JOIN yoneticiler y ON y.id=a.actor_id AND a.actor_role='admin'
        WHERE a.entity_path LIKE $1 ORDER BY a.created_at DESC LIMIT 100`,
      [`/api/admin/${req.params.accountType === "cavus" ? "cavuslar" : "soforler"}/${req.params.id}%`]
    ),
  ]);
  const labels = { POST: "oluşturdu", PUT: "güncelledi", PATCH: "güncelledi", DELETE: "sildi" };
  const auditEvents = audit.rows.map((item) => ({ ...item, id: `audit-${item.id}`, summary: `Yönetici personel kaydını ${labels[item.action] || "işledi"}.`, actor_role: "admin" }));
  const combined = [...events, ...auditEvents].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100);
  return successResponse(res, "Personel işlem geçmişi getirildi.", combined);
});

module.exports = { getPermissions, updatePermissions, resetPermissions, getPersonTimeline };

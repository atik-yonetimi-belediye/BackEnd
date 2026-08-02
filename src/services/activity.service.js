const pool = require("../config/db");

async function recordActivity(queryable, {
  actorRole, actorId, actorName, entityType, entityId, action, summary, metadata = {},
}) {
  await queryable.query(
    `INSERT INTO activity_events
       (actor_role, actor_id, actor_name, entity_type, entity_id, action, summary, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [actorRole, actorId || null, actorName || null, entityType, entityId, action, summary, JSON.stringify(metadata)]
  );
}

async function getTimeline(entityType, entityId, limit = 100) {
  const result = await pool.query(
    `SELECT id, actor_role, actor_id, actor_name, entity_type, entity_id,
            action, summary, metadata, created_at
       FROM activity_events
      WHERE (entity_type = $1 AND entity_id = $2)
         OR (metadata->>'related_entity_type' = $1 AND (metadata->>'related_entity_id')::int = $2)
      ORDER BY created_at DESC LIMIT $3`,
    [entityType, entityId, limit]
  );
  return result.rows;
}

module.exports = { recordActivity, getTimeline };

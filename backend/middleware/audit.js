const AuditLog = require("../models/AuditLog");

/*
 * Fires an audit entry for a sensitive action without blocking the
 * response — logging failures should never break the actual request.
 * Usage: router.get("/:userId/risk/history", requireAuth, audit("risk.view"), handler)
 * Must run AFTER requireAuth so req.user is populated. Reads
 * req.params.userId as the target when present.
 */
function audit(action) {
  return (req, res, next) => {
    AuditLog.create({
      actor: req.user.id,
      actorRole: req.user.role,
      action,
      targetUser: req.params.userId || req.user.id,
      metadata: { path: req.originalUrl, method: req.method },
    }).catch((err) => console.error("[audit] failed to write log:", err.message));
    next();
  };
}

module.exports = audit;

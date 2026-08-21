const mongoose = require("mongoose");

/*
 * Append-only record of who viewed or computed which student's risk
 * data, and when. Risk scores are sensitive — a student's academic
 * standing shouldn't be viewable without a trace of who looked.
 * This is intentionally minimal (no update/delete route exposed
 * anywhere) so it stays a reliable audit trail.
 */
const AuditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: { type: String, required: true },
    college: { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true, index: true },
    action: { type: String, required: true }, // e.g. "risk.view", "risk.compute", "resume.view"
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

AuditLogSchema.index({ targetUser: 1, createdAt: -1 });
AuditLogSchema.index({ college: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);

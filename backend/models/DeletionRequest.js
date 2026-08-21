const mongoose = require("mongoose");

/*
 * A student/staff member's request to have their account and data
 * deleted. Kept as a reviewable queue rather than an instant cascade
 * delete — an admin should confirm before institution records
 * (resumes, risk history tied to academic records) are permanently
 * removed. This is a starting point for DPDP Act (India) "right to
 * erasure" support, not a complete compliance implementation.
 */
const DeletionRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    college: { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true },
    status: { type: String, enum: ["pending", "completed", "declined"], default: "pending" },
    requestedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DeletionRequest", DeletionRequestSchema);

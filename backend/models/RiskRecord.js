const mongoose = require("mongoose");

/*
 * One row per risk-score computation. Kept historical (not overwritten)
 * so faculty/admin dashboards can show a trend line, not just a snapshot.
 */
const RiskRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    college: { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true, index: true },
    riskScore: { type: Number, min: 0, max: 1, required: true }, // probability of academic risk
    riskLevel: { type: String, enum: ["low", "medium", "high"], required: true },
    topFactors: [{ factor: String, contribution: Number }], // explainability
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RiskRecord", RiskRecordSchema);

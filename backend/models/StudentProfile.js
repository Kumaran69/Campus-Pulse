const mongoose = require("mongoose");

/*
 * Holds the raw academic + engagement signals for a student.
 * This is what gets sent to the ML risk-scoring service, and what
 * faculty see explained on the Risk Radar dashboard.
 */
const StudentProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    college: { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true, index: true },
    attendancePercent: { type: Number, min: 0, max: 100, default: 85 },
    averageGrade: { type: Number, min: 0, max: 100, default: 70 }, // 0-100 scale
    assignmentsCompletedPercent: { type: Number, min: 0, max: 100, default: 90 },
    backlogs: { type: Number, min: 0, default: 0 },
    lmsLoginsPerWeek: { type: Number, min: 0, default: 5 }, // engagement signal
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentProfile", StudentProfileSchema);

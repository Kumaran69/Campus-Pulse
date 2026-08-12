const express = require("express");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const User = require("../models/User");
const RiskRecord = require("../models/RiskRecord");
const Resume = require("../models/Resume");
const JobPosting = require("../models/JobPosting");

const router = express.Router();

// GET /api/analytics/overview — admin-only institution health snapshot
router.get("/overview", requireAuth, requireRole("admin"), async (req, res) => {
  const [studentCount, facultyCount, tpoCount, resumeCount, jobCount] = await Promise.all([
    User.countDocuments({ role: "student" }),
    User.countDocuments({ role: "faculty" }),
    User.countDocuments({ role: "tpo" }),
    Resume.countDocuments({}),
    JobPosting.countDocuments({ isActive: true }),
  ]);

  // Latest risk record per student, bucketed by level.
  const latestPerStudent = await RiskRecord.aggregate([
    { $sort: { computedAt: -1 } },
    { $group: { _id: "$user", riskLevel: { $first: "$riskLevel" }, riskScore: { $first: "$riskScore" } } },
  ]);

  const riskBuckets = { low: 0, medium: 0, high: 0 };
  latestPerStudent.forEach((r) => {
    if (riskBuckets[r.riskLevel] !== undefined) riskBuckets[r.riskLevel] += 1;
  });

  res.json({
    counts: { students: studentCount, faculty: facultyCount, tpo: tpoCount, resumes: resumeCount, activeJobs: jobCount },
    riskBuckets,
    resumeCompletionRate: studentCount > 0 ? Math.round((resumeCount / studentCount) * 100) : 0,
  });
});

module.exports = router;

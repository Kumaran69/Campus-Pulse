const express = require("express");
const { query } = require("express-validator");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const asyncHandler = require("../middleware/asyncHandler");
const { handleValidation } = require("../middleware/validate");
const User = require("../models/User");
const RiskRecord = require("../models/RiskRecord");
const Resume = require("../models/Resume");
const JobPosting = require("../models/JobPosting");
const AuditLog = require("../models/AuditLog");

const router = express.Router();

// GET /api/analytics/overview — admin-only institution health snapshot
router.get("/overview", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
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
}));

// GET /api/analytics/audit-logs — admin-only view into who accessed sensitive
// student data (risk scores, resumes, screener runs) and when.
router.get(
  "/audit-logs",
  requireAuth,
  requireRole("admin"),
  query("limit").optional().isInt({ min: 1, max: 200 }),
  handleValidation,
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 50;
    const logs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("actor", "name email role")
      .populate("targetUser", "name rollNumber");
    res.json({ logs });
  })
);

module.exports = router;

const express = require("express");
const axios = require("axios");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const RiskRecord = require("../models/RiskRecord");

const router = express.Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8001";

// GET /api/students/me/profile — a student viewing their own academic signals
router.get("/me/profile", requireAuth, requireRole("student"), async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user.id });
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  res.json({ profile });
});

// PUT /api/students/me/profile — faculty/admin normally update this via bulk import;
// exposed here too so the demo is self-contained without a separate ingestion job.
router.put("/:userId/profile", requireAuth, requireRole("faculty", "admin"), async (req, res) => {
  const { attendancePercent, averageGrade, assignmentsCompletedPercent, backlogs, lmsLoginsPerWeek } = req.body;
  const profile = await StudentProfile.findOneAndUpdate(
    { user: req.params.userId },
    {
      $set: {
        ...(attendancePercent !== undefined && { attendancePercent }),
        ...(averageGrade !== undefined && { averageGrade }),
        ...(assignmentsCompletedPercent !== undefined && { assignmentsCompletedPercent }),
        ...(backlogs !== undefined && { backlogs }),
        ...(lmsLoginsPerWeek !== undefined && { lmsLoginsPerWeek }),
        lastUpdated: new Date(),
      },
    },
    { new: true, upsert: true }
  );
  res.json({ profile });
});

// POST /api/students/:userId/risk/compute — calls the ML microservice and stores the result
router.post("/:userId/risk/compute", requireAuth, requireRole("faculty", "admin", "student"), async (req, res) => {
  try {
    const { userId } = req.params;

    // Students may only trigger a recompute for themselves.
    if (req.user.role === "student" && req.user.id !== userId) {
      return res.status(403).json({ error: "Students can only view their own risk score" });
    }

    const profile = await StudentProfile.findOne({ user: userId });
    if (!profile) return res.status(404).json({ error: "Student profile not found" });

    const { data } = await axios.post(`${ML_SERVICE_URL}/predict`, {
      attendance_percent: profile.attendancePercent,
      average_grade: profile.averageGrade,
      assignments_completed_percent: profile.assignmentsCompletedPercent,
      backlogs: profile.backlogs,
      lms_logins_per_week: profile.lmsLoginsPerWeek,
    });

    const record = await RiskRecord.create({
      user: userId,
      riskScore: data.risk_score,
      riskLevel: data.risk_level,
      topFactors: data.top_factors,
    });

    res.json({ record });
  } catch (err) {
    res.status(502).json({ error: "Risk prediction service unavailable", detail: err.message });
  }
});

// GET /api/students/:userId/risk/history
router.get("/:userId/risk/history", requireAuth, requireRole("faculty", "admin", "student"), async (req, res) => {
  const { userId } = req.params;
  if (req.user.role === "student" && req.user.id !== userId) {
    return res.status(403).json({ error: "Students can only view their own risk history" });
  }
  const history = await RiskRecord.find({ user: userId }).sort({ computedAt: -1 }).limit(20);
  res.json({ history });
});

// GET /api/students/radar — faculty dashboard: every student ranked by latest risk score
router.get("/radar", requireAuth, requireRole("faculty", "admin"), async (req, res) => {
  const students = await User.find({ role: "student" }).select("-password");

  const rows = await Promise.all(
    students.map(async (student) => {
      const [profile, latestRisk] = await Promise.all([
        StudentProfile.findOne({ user: student._id }),
        RiskRecord.findOne({ user: student._id }).sort({ computedAt: -1 }),
      ]);
      return {
        student: { id: student._id, name: student.name, rollNumber: student.rollNumber, department: student.department, year: student.year },
        profile,
        latestRisk,
      };
    })
  );

  // Highest risk first so faculty see who needs attention at the top.
  rows.sort((a, b) => (b.latestRisk?.riskScore || 0) - (a.latestRisk?.riskScore || 0));

  res.json({ rows });
});

module.exports = router;

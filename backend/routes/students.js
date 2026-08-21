const express = require("express");
const axios = require("axios");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const { body, param } = require("express-validator");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const asyncHandler = require("../middleware/asyncHandler");
const audit = require("../middleware/audit");
const { handleValidation } = require("../middleware/validate");
const { sendMail } = require("../utils/mailer");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const RiskRecord = require("../models/RiskRecord");

const router = express.Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8001";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const profileUpdateValidators = [
  param("userId").isMongoId().withMessage("Invalid student id"),
  body("attendancePercent").optional().isFloat({ min: 0, max: 100 }),
  body("averageGrade").optional().isFloat({ min: 0, max: 100 }),
  body("assignmentsCompletedPercent").optional().isFloat({ min: 0, max: 100 }),
  body("backlogs").optional().isInt({ min: 0 }),
  body("lmsLoginsPerWeek").optional().isFloat({ min: 0 }),
];

// GET /api/students/me/profile — a student viewing their own academic signals
router.get("/me/profile", requireAuth, requireRole("student"), asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user.id });
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  res.json({ profile });
}));

// PUT /api/students/:userId/profile — faculty/admin editing one student manually.
router.put(
  "/:userId/profile",
  requireAuth,
  requireRole("faculty", "admin"),
  profileUpdateValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    // Confirm the target student is actually in the caller's college —
    // without this, a faculty account from College A could edit a
    // student's data at College B just by guessing/enumerating IDs.
    const targetUser = await User.findOne({ _id: req.params.userId, college: req.user.collegeId, role: "student" });
    if (!targetUser) return res.status(404).json({ error: "Student not found in your college" });

    const { attendancePercent, averageGrade, assignmentsCompletedPercent, backlogs, lmsLoginsPerWeek } = req.body;
    const profile = await StudentProfile.findOneAndUpdate(
      { user: targetUser._id },
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
      { new: true }
    );
    res.json({ profile });
  })
);

// POST /api/students/bulk-import — faculty/admin upload a CSV of attendance,
// grades, and engagement signals to update many students in one pass instead
// of editing each profile by hand. Expected columns: rollNumber,
// attendancePercent, averageGrade, assignmentsCompletedPercent, backlogs, lmsLoginsPerWeek
router.post(
  "/bulk-import",
  requireAuth,
  requireRole("faculty", "admin"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Attach a CSV file under the 'file' field" });

    let records;
    try {
      records = parse(req.file.buffer.toString("utf-8"), { columns: true, skip_empty_lines: true, trim: true });
    } catch (err) {
      return res.status(400).json({ error: "Could not parse CSV file", detail: err.message });
    }

    if (records.length > 2000) {
      return res.status(400).json({ error: "CSV has too many rows (max 2000 per import)" });
    }

    const results = { updated: 0, skipped: [] };
    const numericField = (raw, min, max) => {
      const n = Number(raw);
      if (Number.isNaN(n)) return undefined;
      return Math.min(Math.max(n, min), max);
    };

    for (const row of records) {
      const rollNumber = (row.rollNumber || "").trim();
      if (!rollNumber) {
        results.skipped.push({ row, reason: "Missing rollNumber" });
        continue;
      }

      const student = await User.findOne({ rollNumber, college: req.user.collegeId, role: "student" });
      if (!student) {
        results.skipped.push({ row, reason: `No student found with roll number ${rollNumber} in your college` });
        continue;
      }

      const update = {};
      const attendancePercent = numericField(row.attendancePercent, 0, 100);
      const averageGrade = numericField(row.averageGrade, 0, 100);
      const assignmentsCompletedPercent = numericField(row.assignmentsCompletedPercent, 0, 100);
      const backlogs = numericField(row.backlogs, 0, 50);
      const lmsLoginsPerWeek = numericField(row.lmsLoginsPerWeek, 0, 100);

      if (attendancePercent !== undefined) update.attendancePercent = attendancePercent;
      if (averageGrade !== undefined) update.averageGrade = averageGrade;
      if (assignmentsCompletedPercent !== undefined) update.assignmentsCompletedPercent = assignmentsCompletedPercent;
      if (backlogs !== undefined) update.backlogs = backlogs;
      if (lmsLoginsPerWeek !== undefined) update.lmsLoginsPerWeek = lmsLoginsPerWeek;
      update.lastUpdated = new Date();

      await StudentProfile.findOneAndUpdate({ user: student._id }, { $set: update }, { upsert: true });
      results.updated += 1;
    }

    res.json(results);
  })
);

// POST /api/students/:userId/risk/compute — calls the ML microservice and stores the result
router.post(
  "/:userId/risk/compute",
  requireAuth,
  requireRole("faculty", "admin", "student"),
  param("userId").isMongoId().withMessage("Invalid student id"),
  handleValidation,
  audit("risk.compute"),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Students may only trigger a recompute for themselves.
    if (req.user.role === "student" && String(req.user.id) !== String(userId)) {
      return res.status(403).json({ error: "Students can only view their own risk score" });
    }

    // Cross-tenant guard: the target student must exist in the caller's college.
    const targetUser = await User.findOne({ _id: userId, college: req.user.collegeId, role: "student" });
    if (!targetUser) return res.status(404).json({ error: "Student not found in your college" });

    const profile = await StudentProfile.findOne({ user: userId });
    if (!profile) return res.status(404).json({ error: "Student profile not found" });

    let data;
    try {
      const response = await axios.post(`${ML_SERVICE_URL}/predict`, {
        attendance_percent: profile.attendancePercent,
        average_grade: profile.averageGrade,
        assignments_completed_percent: profile.assignmentsCompletedPercent,
        backlogs: profile.backlogs,
        lms_logins_per_week: profile.lmsLoginsPerWeek,
      });
      data = response.data;
    } catch (err) {
      return res.status(502).json({ error: "Risk prediction service unavailable", detail: err.message });
    }

    const record = await RiskRecord.create({
      user: userId,
      college: req.user.collegeId,
      riskScore: data.risk_score,
      riskLevel: data.risk_level,
      topFactors: data.top_factors,
    });

    // Best-effort notification — never blocks or fails the response.
    if (data.risk_level === "high") {
      sendMail({
        to: targetUser.email,
        subject: "Your academic risk status needs attention",
        text: `Hi ${targetUser.name}, your latest Campus Pulse check-in flagged you as high risk. Top contributing factors: ${data.top_factors.map((f) => f.factor).join(", ")}. Please reach out to your faculty mentor or your department's student support desk. — Campus Pulse`,
      }).catch(() => {});
    }

    res.json({ record });
  })
);

// GET /api/students/:userId/risk/history
router.get(
  "/:userId/risk/history",
  requireAuth,
  requireRole("faculty", "admin", "student"),
  param("userId").isMongoId().withMessage("Invalid student id"),
  handleValidation,
  audit("risk.view"),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (req.user.role === "student" && String(req.user.id) !== String(userId)) {
      return res.status(403).json({ error: "Students can only view their own risk history" });
    }
    const history = await RiskRecord.find({ user: userId, college: req.user.collegeId }).sort({ computedAt: -1 }).limit(20);
    res.json({ history });
  })
);

// GET /api/students/radar — faculty dashboard: every student in the caller's
// college, ranked by latest risk score.
router.get(
  "/radar",
  requireAuth,
  requireRole("faculty", "admin"),
  audit("risk.radar_view"),
  asyncHandler(async (req, res) => {
    const students = await User.find({ role: "student", college: req.user.collegeId }).select("-password");

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

    rows.sort((a, b) => (b.latestRisk?.riskScore || 0) - (a.latestRisk?.riskScore || 0));

    res.json({ rows });
  })
);

module.exports = router;

const express = require("express");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const asyncHandler = require("../middleware/asyncHandler");
const audit = require("../middleware/audit");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const Resume = require("../models/Resume");
const RiskRecord = require("../models/RiskRecord");
const DeletionRequest = require("../models/DeletionRequest");

const router = express.Router();

// GET /api/privacy/export — "right to access": every logged-in person can
// download everything Campus Pulse holds about them, as JSON.
router.get("/export", requireAuth, audit("privacy.export"), asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const exportData = { account: user.toSafeObject() };

  if (user.role === "student") {
    const [profile, resume, riskHistory] = await Promise.all([
      StudentProfile.findOne({ user: user._id }),
      Resume.findOne({ user: user._id }),
      RiskRecord.find({ user: user._id }).sort({ computedAt: -1 }),
    ]);
    exportData.academicProfile = profile;
    exportData.resume = resume;
    exportData.riskHistory = riskHistory;
  }

  res.setHeader("Content-Disposition", "attachment; filename=campus-pulse-my-data.json");
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(exportData, null, 2));
}));

// POST /api/privacy/delete-request — "right to erasure": queues a request
// for an admin to review, rather than deleting immediately. Academic
// records may need retention review before removal, so this is a
// request queue, not an instant cascade delete.
router.post("/delete-request", requireAuth, audit("privacy.delete_request"), asyncHandler(async (req, res) => {
  const existing = await DeletionRequest.findOne({ user: req.user.id, status: "pending" });
  if (existing) {
    return res.status(409).json({ error: "You already have a pending deletion request" });
  }

  const request = await DeletionRequest.create({
    user: req.user.id,
    college: req.user.collegeId,
    status: "pending",
  });

  res.status(201).json({ request });
}));

// GET /api/privacy/deletion-requests — admin-only queue for their college.
router.get("/deletion-requests", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const requests = await DeletionRequest.find({ college: req.user.collegeId, status: "pending" })
    .sort({ requestedAt: -1 })
    .populate("user", "name email role rollNumber");
  res.json({ requests });
}));

module.exports = router;

const express = require("express");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const Resume = require("../models/Resume");

const router = express.Router();

// GET /api/resumes/me
router.get("/me", requireAuth, requireRole("student"), async (req, res) => {
  const resume = await Resume.findOne({ user: req.user.id });
  res.json({ resume });
});

// PUT /api/resumes/me — create or update the student's own resume
router.put("/me", requireAuth, requireRole("student"), async (req, res) => {
  const { fullName, headline, summary, skills, education, experience, projects } = req.body;

  const resume = await Resume.findOneAndUpdate(
    { user: req.user.id },
    { $set: { fullName, headline, summary, skills, education, experience, projects } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  res.json({ resume });
});

// GET /api/resumes/:userId — faculty/tpo/admin viewing a specific student's resume
router.get("/:userId", requireAuth, requireRole("faculty", "tpo", "admin"), async (req, res) => {
  const resume = await Resume.findOne({ user: req.params.userId });
  if (!resume) return res.status(404).json({ error: "Resume not found for this student" });
  res.json({ resume });
});

module.exports = router;

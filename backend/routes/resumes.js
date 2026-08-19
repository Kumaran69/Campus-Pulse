const express = require("express");
const { body, param } = require("express-validator");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const asyncHandler = require("../middleware/asyncHandler");
const audit = require("../middleware/audit");
const { handleValidation } = require("../middleware/validate");
const Resume = require("../models/Resume");

const router = express.Router();

const resumeValidators = [
  body("fullName").optional().trim().isLength({ max: 150 }),
  body("headline").optional().trim().isLength({ max: 200 }),
  body("summary").optional().trim().isLength({ max: 2000 }),
  body("skills").optional().isArray({ max: 50 }).withMessage("skills must be a list"),
  body("skills.*").optional().isString().trim().isLength({ max: 60 }),
  body("education").optional().isArray({ max: 20 }),
  body("experience").optional().isArray({ max: 30 }),
  body("projects").optional().isArray({ max: 30 }),
];

// GET /api/resumes/me
router.get("/me", requireAuth, requireRole("student"), asyncHandler(async (req, res) => {
  const resume = await Resume.findOne({ user: req.user.id });
  res.json({ resume });
}));

// PUT /api/resumes/me — create or update the student's own resume
router.put(
  "/me",
  requireAuth,
  requireRole("student"),
  resumeValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const { fullName, headline, summary, skills, education, experience, projects } = req.body;

    const resume = await Resume.findOneAndUpdate(
      { user: req.user.id },
      { $set: { fullName, headline, summary, skills, education, experience, projects } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ resume });
  })
);

// GET /api/resumes/:userId — faculty/tpo/admin viewing a specific student's resume
router.get(
  "/:userId",
  requireAuth,
  requireRole("faculty", "tpo", "admin"),
  param("userId").isMongoId().withMessage("Invalid student id"),
  handleValidation,
  audit("resume.view"),
  asyncHandler(async (req, res) => {
    const resume = await Resume.findOne({ user: req.params.userId });
    if (!resume) return res.status(404).json({ error: "Resume not found for this student" });
    res.json({ resume });
  })
);

module.exports = router;

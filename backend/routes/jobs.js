const express = require("express");
const axios = require("axios");
const { body, param } = require("express-validator");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const asyncHandler = require("../middleware/asyncHandler");
const audit = require("../middleware/audit");
const { handleValidation } = require("../middleware/validate");
const JobPosting = require("../models/JobPosting");
const Resume = require("../models/Resume");

const router = express.Router();
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8002";

const jobValidators = [
  body("title").trim().isLength({ min: 2, max: 150 }).withMessage("Title is required"),
  body("company").trim().isLength({ min: 2, max: 150 }).withMessage("Company is required"),
  body("description").trim().isLength({ min: 10, max: 5000 }).withMessage("Description must be at least 10 characters"),
  body("requiredSkills").optional().isArray({ max: 50 }),
  body("requiredSkills.*").optional().isString().trim().isLength({ max: 60 }),
];

// POST /api/jobs — TPO creates a job posting, scoped to their own college
router.post(
  "/",
  requireAuth,
  requireRole("tpo", "admin"),
  jobValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const { title, company, description, requiredSkills } = req.body;
    const job = await JobPosting.create({
      postedBy: req.user.id,
      college: req.user.collegeId,
      title,
      company,
      description,
      requiredSkills: requiredSkills || [],
    });
    res.status(201).json({ job });
  })
);

// GET /api/jobs — active postings for the caller's own college only
router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const jobs = await JobPosting.find({ isActive: true, college: req.user.collegeId }).sort({ createdAt: -1 });
  res.json({ jobs });
}));

// GET /api/jobs/:jobId/screen — TPO ranks every student resume *in their own
// college* against this JD. Cross-tenant guard prevents a TPO from one
// college screening students that belong to a different one.
router.get(
  "/:jobId/screen",
  requireAuth,
  requireRole("tpo", "admin"),
  param("jobId").isMongoId().withMessage("Invalid job id"),
  handleValidation,
  audit("resume.screen"),
  asyncHandler(async (req, res) => {
    const job = await JobPosting.findOne({ _id: req.params.jobId, college: req.user.collegeId });
    if (!job) return res.status(404).json({ error: "Job posting not found in your college" });

    const resumes = await Resume.find({ college: req.user.collegeId, rawText: { $exists: true, $ne: "" } }).populate("user", "name rollNumber department year");
    if (resumes.length === 0) {
      return res.json({ job, rankings: [] });
    }

    let data;
    try {
      const response = await axios.post(`${RAG_SERVICE_URL}/screen`, {
        job_description: job.description,
        required_skills: job.requiredSkills,
        candidates: resumes.map((r) => ({
          id: r._id.toString(),
          name: r.user?.name || "Unknown",
          text: r.rawText,
        })),
      });
      data = response.data;
    } catch (err) {
      return res.status(502).json({ error: "Resume screening service unavailable", detail: err.message });
    }

    res.json({ job, rankings: data.rankings });
  })
);

module.exports = router;

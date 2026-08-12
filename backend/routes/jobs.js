const express = require("express");
const axios = require("axios");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const JobPosting = require("../models/JobPosting");
const Resume = require("../models/Resume");

const router = express.Router();
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8002";

// POST /api/jobs — TPO creates a job posting
router.post("/", requireAuth, requireRole("tpo", "admin"), async (req, res) => {
  const { title, company, description, requiredSkills } = req.body;
  if (!title || !company || !description) {
    return res.status(400).json({ error: "title, company and description are required" });
  }
  const job = await JobPosting.create({
    postedBy: req.user.id,
    title,
    company,
    description,
    requiredSkills: requiredSkills || [],
  });
  res.status(201).json({ job });
});

// GET /api/jobs — anyone logged in can browse active postings (students apply, TPO manages)
router.get("/", requireAuth, async (req, res) => {
  const jobs = await JobPosting.find({ isActive: true }).sort({ createdAt: -1 });
  res.json({ jobs });
});

// GET /api/jobs/:jobId/screen — TPO ranks every student resume against this JD
router.get("/:jobId/screen", requireAuth, requireRole("tpo", "admin"), async (req, res) => {
  try {
    const job = await JobPosting.findById(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job posting not found" });

    const resumes = await Resume.find({ rawText: { $exists: true, $ne: "" } }).populate("user", "name rollNumber department year");
    if (resumes.length === 0) {
      return res.json({ job, rankings: [] });
    }

    const { data } = await axios.post(`${RAG_SERVICE_URL}/screen`, {
      job_description: job.description,
      required_skills: job.requiredSkills,
      candidates: resumes.map((r) => ({
        id: r._id.toString(),
        name: r.user?.name || "Unknown",
        text: r.rawText,
      })),
    });

    res.json({ job, rankings: data.rankings });
  } catch (err) {
    res.status(502).json({ error: "Resume screening service unavailable", detail: err.message });
  }
});

module.exports = router;

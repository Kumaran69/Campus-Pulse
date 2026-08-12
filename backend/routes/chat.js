const express = require("express");
const axios = require("axios");
const requireAuth = require("../middleware/auth");

const router = express.Router();
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8002";

// POST /api/chat — every logged-in role can ask Campus Copilot questions;
// student context (department/year) is passed through for more relevant answers.
router.post("/", requireAuth, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    const { data } = await axios.post(`${RAG_SERVICE_URL}/chat`, {
      message,
      history: history || [],
      user_role: req.user.role,
    });

    res.json({ answer: data.answer, sources: data.sources });
  } catch (err) {
    res.status(502).json({ error: "Campus Copilot is temporarily unavailable", detail: err.message });
  }
});

module.exports = router;

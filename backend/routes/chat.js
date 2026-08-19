const express = require("express");
const axios = require("axios");
const { body } = require("express-validator");
const requireAuth = require("../middleware/auth");
const { handleValidation } = require("../middleware/validate");

const router = express.Router();
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8002";

const chatValidators = [
  // Capped length stops someone pasting a huge blob to hammer the
  // retrieval service's vectorizer with an oversized query.
  body("message").trim().isLength({ min: 1, max: 1000 }).withMessage("Message must be 1-1000 characters"),
  body("history").optional().isArray({ max: 20 }),
];

// POST /api/chat — every logged-in role can ask Campus Copilot questions.
router.post("/", requireAuth, chatValidators, handleValidation, async (req, res) => {
  try {
    const { message, history } = req.body;

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

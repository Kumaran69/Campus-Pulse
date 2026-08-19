const express = require("express");
const jwt = require("jsonwebtoken");
const { body } = require("express-validator");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const asyncHandler = require("../middleware/asyncHandler");
const { handleValidation } = require("../middleware/validate");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

const registerValidators = [
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2-100 characters"),
  body("email").trim().isEmail().withMessage("A valid email is required").normalizeEmail(),
  body("password").isLength({ min: 6, max: 128 }).withMessage("Password must be at least 6 characters"),
  body("role").optional().isIn(["student", "faculty", "tpo", "admin"]).withMessage("Invalid role"),
  body("rollNumber").optional().trim().isLength({ max: 40 }),
  body("department").optional().trim().isLength({ max: 100 }),
  body("year").optional().isInt({ min: 1, max: 5 }).withMessage("Year must be between 1 and 5"),
];

const loginValidators = [
  body("email").trim().isEmail().withMessage("A valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

// POST /api/auth/register
router.post("/register", registerValidators, handleValidation, asyncHandler(async (req, res) => {
  const { name, email, password, role, rollNumber, department, year } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const user = await User.create({
    name,
    email,
    password,
    role: ["student", "faculty", "tpo", "admin"].includes(role) ? role : "student",
    rollNumber,
    department,
    year,
  });

  // Every student gets a baseline profile so the risk model has something to score.
  if (user.role === "student") {
    await StudentProfile.create({ user: user._id });
  }

  const token = signToken(user);
  res.status(201).json({ token, user: user.toSafeObject() });
}));

// POST /api/auth/login
router.post("/login", loginValidators, handleValidation, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const ok = await user.comparePassword(password);
  if (!ok) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken(user);
  res.json({ token, user: user.toSafeObject() });
}));

// GET /api/auth/me — used by frontend to rehydrate session from a stored token
router.get("/me", require("../middleware/auth"), asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: user.toSafeObject() });
}));

module.exports = router;

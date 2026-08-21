const express = require("express");
const jwt = require("jsonwebtoken");
const { body } = require("express-validator");
const User = require("../models/User");
const College = require("../models/College");
const StudentProfile = require("../models/StudentProfile");
const asyncHandler = require("../middleware/asyncHandler");
const { handleValidation } = require("../middleware/validate");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name, email: user.email, collegeId: user.college },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

const registerValidators = [
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2-100 characters"),
  body("email").trim().isEmail().withMessage("A valid email is required").normalizeEmail(),
  body("password").isLength({ min: 6, max: 128 }).withMessage("Password must be at least 6 characters"),
  body("role").optional().isIn(["student", "faculty", "tpo", "admin"]).withMessage("Invalid role"),
  body("collegeCode").trim().isLength({ min: 3, max: 20 }).withMessage("A college code is required — ask your admin for it"),
  body("rollNumber").optional().trim().isLength({ max: 40 }),
  body("department").optional().trim().isLength({ max: 100 }),
  body("year").optional().isInt({ min: 1, max: 5 }).withMessage("Year must be between 1 and 5"),
  body("consentGiven").custom((v) => v === true).withMessage("You must accept the data consent notice to continue"),
];

const loginValidators = [
  body("email").trim().isEmail().withMessage("A valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

// POST /api/auth/register
router.post("/register", registerValidators, handleValidation, asyncHandler(async (req, res) => {
  const { name, email, password, role, rollNumber, department, year, collegeCode } = req.body;

  const college = await College.findOne({ code: collegeCode.toUpperCase() });
  if (!college) {
    return res.status(404).json({ error: "No college found with that code. Double-check it with your admin." });
  }

  // Optional domain restriction — if the college has configured allowed
  // email domains, self-registration is limited to those (prevents
  // random signups against a real institution's tenant).
  if (college.emailDomains?.length > 0) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!college.emailDomains.includes(domain)) {
      return res.status(400).json({
        error: `Please register with your official college email (${college.emailDomains.join(", ")})`,
      });
    }
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const user = await User.create({
    name,
    email,
    password,
    role: ["student", "faculty", "tpo", "admin"].includes(role) ? role : "student",
    college: college._id,
    rollNumber,
    department,
    year,
    consentGiven: true,
    consentAt: new Date(),
  });

  // Every student gets a baseline profile so the risk model has something to score.
  if (user.role === "student") {
    await StudentProfile.create({ user: user._id, college: college._id });
  }

  const token = signToken(user);
  res.status(201).json({
    token,
    user: user.toSafeObject(),
    college: { id: college._id, name: college.name, code: college.code },
  });
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

  const college = await College.findById(user.college);
  const token = signToken(user);
  res.json({
    token,
    user: user.toSafeObject(),
    college: college ? { id: college._id, name: college.name, code: college.code } : null,
  });
}));

// GET /api/auth/me — used by frontend to rehydrate session from a stored token
router.get("/me", require("../middleware/auth"), asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const college = await College.findById(user.college);
  res.json({ user: user.toSafeObject(), college: college ? { id: college._id, name: college.name, code: college.code } : null });
}));

module.exports = router;

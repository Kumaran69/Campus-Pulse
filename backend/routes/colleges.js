const express = require("express");
const jwt = require("jsonwebtoken");
const { body, param } = require("express-validator");
const College = require("../models/College");
const User = require("../models/User");
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

function slugify(name) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6) || "COLLEGE";
}

async function generateUniqueCode(name) {
  const base = slugify(name);
  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = Math.floor(1000 + Math.random() * 9000); // 4-digit suffix
    const candidate = `${base}${suffix}`;
    const exists = await College.findOne({ code: candidate });
    if (!exists) return candidate;
  }
  throw new Error("Could not generate a unique college code, please try again");
}

const setupValidators = [
  body("collegeName").trim().isLength({ min: 2, max: 150 }).withMessage("College name is required"),
  body("adminName").trim().isLength({ min: 2, max: 100 }).withMessage("Admin name is required"),
  body("adminEmail").trim().isEmail().withMessage("A valid email is required").normalizeEmail(),
  body("adminPassword").isLength({ min: 6, max: 128 }).withMessage("Password must be at least 6 characters"),
  body("consentGiven").custom((v) => v === true).withMessage("You must accept the data consent notice to continue"),
];

// POST /api/colleges/setup — self-serve: creates a new college tenant
// plus its first admin account, in one step. This is the entry point
// for onboarding a brand new institution with no manual work on our end.
router.post("/setup", setupValidators, handleValidation, asyncHandler(async (req, res) => {
  const { collegeName, adminName, adminEmail, adminPassword } = req.body;

  const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });
  if (existingAdmin) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const code = await generateUniqueCode(collegeName);
  const college = await College.create({ name: collegeName, code });

  const admin = await User.create({
    name: adminName,
    email: adminEmail,
    password: adminPassword,
    role: "admin",
    college: college._id,
    consentGiven: true,
    consentAt: new Date(),
  });

  const token = signToken(admin);
  res.status(201).json({
    token,
    user: admin.toSafeObject(),
    college: { id: college._id, name: college.name, code: college.code },
  });
}));

// GET /api/colleges/:code — public lookup so the registration form can
// confirm "you're joining <College Name>" before someone signs up.
// Deliberately returns only the name, nothing sensitive.
router.get(
  "/:code",
  param("code").trim().isLength({ min: 3, max: 20 }),
  handleValidation,
  asyncHandler(async (req, res) => {
    const college = await College.findOne({ code: req.params.code.toUpperCase() });
    if (!college) return res.status(404).json({ error: "No college found with that code" });
    res.json({ college: { name: college.name, code: college.code } });
  })
);

module.exports = router;

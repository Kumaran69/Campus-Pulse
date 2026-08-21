const mongoose = require("mongoose");

/*
 * Every other collection (User, StudentProfile, Resume, JobPosting,
 * RiskRecord, AuditLog) carries a collegeId pointing here. This is
 * what turns Campus Pulse from "one instance per college" into a
 * real multi-tenant product: one deployment, many colleges, each
 * seeing only their own data.
 */
const CollegeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Short, shareable code students/faculty use to join at registration
    // (e.g. "KCET4821"). Shown to the admin right after setup.
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    // Optional: restrict self-registration to official college email
    // domains (e.g. ["kcet.ac.in"]). Empty = no restriction (useful for demos).
    emailDomains: [{ type: String, lowercase: true, trim: true }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("College", CollegeSchema);

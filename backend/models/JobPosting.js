const mongoose = require("mongoose");

const JobPostingSchema = new mongoose.Schema(
  {
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    college: { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true, index: true },
    title: { type: String, required: true },
    company: { type: String, required: true },
    description: { type: String, required: true }, // full JD text, used for semantic matching
    requiredSkills: [String],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("JobPosting", JobPostingSchema);

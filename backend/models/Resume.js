const mongoose = require("mongoose");

const ResumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fullName: String,
    headline: String,
    summary: String,
    skills: [String],
    education: [
      {
        institution: String,
        degree: String,
        startYear: Number,
        endYear: Number,
        score: String,
      },
    ],
    experience: [
      {
        title: String,
        organization: String,
        startDate: String,
        endDate: String,
        description: String,
      },
    ],
    projects: [
      {
        title: String,
        description: String,
        techStack: [String],
        link: String,
      },
    ],
    rawText: { type: String }, // flattened text used by the screener for semantic matching
  },
  { timestamps: true }
);

// Keep a flattened text blob in sync so the resume-screener microservice
// can do similarity matching without re-parsing the structured document.
ResumeSchema.pre("save", function (next) {
  const parts = [
    this.fullName,
    this.headline,
    this.summary,
    (this.skills || []).join(" "),
    ...(this.experience || []).map((e) => `${e.title} ${e.organization} ${e.description}`),
    ...(this.projects || []).map((p) => `${p.title} ${p.description} ${(p.techStack || []).join(" ")}`),
  ];
  this.rawText = parts.filter(Boolean).join(" \n ");
  next();
});

module.exports = mongoose.model("Resume", ResumeSchema);

/*
 * Seeds a demo college tenant with one account per role plus a handful
 * of students with varied risk profiles, so a fresh clone has something
 * to click through immediately instead of an empty dashboard.
 *
 * Usage: node seed.js   (run from inside backend/, with MONGO_URI set)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const College = require("./models/College");
const User = require("./models/User");
const StudentProfile = require("./models/StudentProfile");
const Resume = require("./models/Resume");
const JobPosting = require("./models/JobPosting");

const DEMO_PASSWORD = "password123";
const DEMO_COLLEGE_CODE = "DEMO1234";
const DEMO_COLLEGE_NAME = "Kamaraj College of Engineering and Technology (Demo)";

async function upsertUser(fields, collegeId) {
  let user = await User.findOne({ email: fields.email });
  if (!user) {
    user = await User.create({ ...fields, college: collegeId, password: DEMO_PASSWORD, consentGiven: true, consentAt: new Date() });
    console.log(`  created ${fields.role}: ${fields.email}`);
  } else {
    console.log(`  exists  ${fields.role}: ${fields.email}`);
  }
  return user;
}

async function run() {
  await connectDB();

  console.log("Seeding demo college...");
  let college = await College.findOne({ code: DEMO_COLLEGE_CODE });
  if (!college) {
    college = await College.create({ name: DEMO_COLLEGE_NAME, code: DEMO_COLLEGE_CODE });
    console.log(`  created college: ${college.name} (code: ${college.code})`);
  } else {
    console.log(`  exists  college: ${college.name} (code: ${college.code})`);
  }

  console.log("Seeding staff accounts...");
  const faculty = await upsertUser({ name: "Dr. Meena Raghavan", email: "faculty@campuspulse.demo", role: "faculty", department: "CSE" }, college._id);
  const tpo = await upsertUser({ name: "Suresh Kannan", email: "tpo@campuspulse.demo", role: "tpo" }, college._id);
  await upsertUser({ name: "College Admin", email: "admin@campuspulse.demo", role: "admin" }, college._id);

  console.log("Seeding students...");
  const studentSeeds = [
    { name: "Arjun Vel", rollNumber: "21CS001", department: "CSE", year: 3, profile: { attendancePercent: 92, averageGrade: 84, assignmentsCompletedPercent: 95, backlogs: 0, lmsLoginsPerWeek: 8 }, resumeSkills: ["Node.js", "React", "MongoDB", "Docker"] },
    { name: "Divya Shree", rollNumber: "21CS014", department: "CSE", year: 3, profile: { attendancePercent: 58, averageGrade: 46, assignmentsCompletedPercent: 40, backlogs: 3, lmsLoginsPerWeek: 1 }, resumeSkills: ["Python", "Pandas", "Scikit-learn"] },
    { name: "Priya Dharshini", rollNumber: "21CS022", department: "CSE", year: 3, profile: { attendancePercent: 74, averageGrade: 63, assignmentsCompletedPercent: 68, backlogs: 1, lmsLoginsPerWeek: 3 }, resumeSkills: ["Node.js", "MongoDB", "AWS", "Docker"] },
    { name: "Karthik Raja", rollNumber: "21CS031", department: "CSE", year: 2, profile: { attendancePercent: 88, averageGrade: 77, assignmentsCompletedPercent: 90, backlogs: 0, lmsLoginsPerWeek: 6 }, resumeSkills: ["Java", "Spring Boot", "MySQL"] },
    { name: "Meera Iyer", rollNumber: "21CS045", department: "IT", year: 3, profile: { attendancePercent: 63, averageGrade: 55, assignmentsCompletedPercent: 50, backlogs: 2, lmsLoginsPerWeek: 2 }, resumeSkills: ["React Native", "Flutter", "Dart"] },
  ];

  for (const s of studentSeeds) {
    const user = await upsertUser(
      { name: s.name, email: `${s.rollNumber.toLowerCase()}@campuspulse.demo`, role: "student", rollNumber: s.rollNumber, department: s.department, year: s.year },
      college._id
    );
    await StudentProfile.findOneAndUpdate({ user: user._id }, { $set: { ...s.profile, college: college._id } }, { upsert: true });
    await Resume.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          college: college._id,
          fullName: s.name,
          headline: `${s.department} student`,
          summary: `${s.department} student passionate about building real-world software.`,
          skills: s.resumeSkills,
          projects: [{ title: "College project", description: `Built a project using ${s.resumeSkills.join(", ")}.`, techStack: s.resumeSkills }],
        },
      },
      { upsert: true }
    );
  }

  console.log("Seeding a sample job posting...");
  const existingJob = await JobPosting.findOne({ title: "Backend Developer Intern", college: college._id });
  if (!existingJob) {
    await JobPosting.create({
      postedBy: tpo._id,
      college: college._id,
      title: "Backend Developer Intern",
      company: "Phoenix Softech",
      description: "Looking for a backend developer intern skilled in Node.js, Express and MongoDB to help build and optimize RESTful APIs.",
      requiredSkills: ["Node.js", "MongoDB", "Express", "Docker"],
    });
    console.log("  created job: Backend Developer Intern @ Phoenix Softech");
  }

  console.log(`\nDone. College join code: ${college.code}`);
  console.log("Demo login password for every seeded account: " + DEMO_PASSWORD);
  console.log("  faculty@campuspulse.demo / tpo@campuspulse.demo / admin@campuspulse.demo");
  console.log("  21cs001@campuspulse.demo ... 21cs045@campuspulse.demo (students)");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

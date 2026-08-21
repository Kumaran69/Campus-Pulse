const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ["student", "faculty", "tpo", "admin"],
      default: "student",
    },
    // Tenant boundary — every query that touches student data must be
    // scoped to this, so one college can never see another's records.
    college: { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true, index: true },
    // Student-only convenience fields, kept here for fast lookups.
    rollNumber: { type: String, trim: true },
    department: { type: String, trim: true },
    year: { type: Number, min: 1, max: 5 },
    // Basic consent trail — what the person agreed to and when, at signup.
    consentGiven: { type: Boolean, default: false },
    consentAt: { type: Date },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

UserSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  // Mongoose gives back `_id` (an ObjectId); the frontend and the JWT
  // payload both use a plain string `id`. Normalizing it here means
  // every place that reads `user.id` after login/register gets the
  // right value, instead of each caller needing to know to convert it.
  obj.id = obj._id.toString();
  if (obj.college) obj.collegeId = obj.college.toString();
  return obj;
};

module.exports = mongoose.model("User", UserSchema);

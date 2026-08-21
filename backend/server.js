require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const collegeRoutes = require("./routes/colleges");
const studentRoutes = require("./routes/students");
const resumeRoutes = require("./routes/resumes");
const jobRoutes = require("./routes/jobs");
const chatRoutes = require("./routes/chat");
const analyticsRoutes = require("./routes/analytics");
const privacyRoutes = require("./routes/privacy");

const app = express();

// Sets sane security headers (X-Content-Type-Options, no X-Powered-By, etc.)
app.use(helmet());

// Access logging — 'combined' is verbose (IP, method, path, status, timing),
// useful for spotting abuse patterns or debugging in production.
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json({ limit: "2mb" }));

// Strips any keys starting with '$' or containing '.' from req.body/query/params,
// which blocks Mongo operator-injection payloads like { "email": { "$ne": null } }.
app.use(mongoSanitize());

// General API rate limit — generous, just stops runaway scripts/scrapers.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again shortly." },
});
app.use("/api", apiLimiter);

// Tighter limit on auth specifically — this is the route brute-force
// and credential-stuffing attempts actually target.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login/register attempts. Please try again in a few minutes." },
});
app.use("/api/auth", authLimiter);
app.use("/api/colleges", authLimiter);

app.get("/health", (req, res) => res.json({ status: "ok", service: "campus-pulse-backend" }));

app.use("/api/auth", authRoutes);
app.use("/api/colleges", collegeRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/privacy", privacyRoutes);

// Catches any /api/* request that didn't match a route above.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Centralized error handler — keeps error shape consistent across every route.
// Never leaks stack traces to the client; full detail still goes to the server log.
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? "Internal server error" : err.message,
  });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`[server] Campus Pulse API listening on :${PORT}`));
});

module.exports = app;

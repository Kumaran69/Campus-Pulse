const { validationResult } = require("express-validator");

// Runs after a set of express-validator check(...) chains; short-circuits
// with a clean 400 + field-level messages if any of them failed.
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = { handleValidation };

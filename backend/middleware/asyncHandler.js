/*
 * Wraps an async route handler so any thrown error or rejected promise
 * is forwarded to Express's error-handling middleware, instead of
 * crashing the process or hanging the request unanswered.
 *
 * Several routes (jobs.js, resumes.js, parts of students.js) were
 * written as plain async functions with no try/catch — a rejected
 * Mongoose call in those would previously leave the request hanging
 * with no response. Wrapping with asyncHandler fixes that uniformly.
 *
 * Usage: router.get("/path", requireAuth, asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;

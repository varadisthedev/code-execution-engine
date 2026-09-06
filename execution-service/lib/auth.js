const API_KEY = process.env.EXECUTION_SERVICE_API_KEY;

// Protects /execute and /health/details. Public GET /health is mounted
// before this middleware — without a key, /execute is an open "run
// arbitrary code for free" endpoint.
function requireApiKey(req, res, next) {
  if (req.header("X-Internal-Api-Key") !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

module.exports = { requireApiKey };

const API_KEY = process.env.EXECUTION_SERVICE_API_KEY;

// Every route needs this, including /health — without it the service is an
// open "run arbitrary code for free" endpoint.
function requireApiKey(req, res, next) {
  if (req.header("X-Internal-Api-Key") !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

module.exports = { requireApiKey };

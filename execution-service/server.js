const express = require("express");
const executeRouter = require("./routes/execute");
const healthRouter = require("./routes/health");
const { requireApiKey } = require("./lib/auth");
const cache = require("./lib/cache");

if (!process.env.EXECUTION_SERVICE_API_KEY) {
  console.error("EXECUTION_SERVICE_API_KEY is not set — refusing to start open to the internet");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// No CORS: this is an internal service the monolith calls server-to-server,
// never a browser. Auth runs before body parsing so unauthorized requests
// don't pay JSON-parse cost.
app.use(requireApiKey);
app.use(express.json({ limit: "256kb" }));
app.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large" });
  }
  if (err) return res.status(400).json({ error: "Invalid request body" });
  next();
});

app.use(healthRouter);
app.use(executeRouter);

(async () => {
  await cache.resetOnBoot(); // never trust a compile cache from a previous container layer
  app.listen(PORT, () => {
    console.log(`execution-service listening on port ${PORT}`);
  });
})();

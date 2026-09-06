const express = require("express");
const router = express.Router();

const pool = require("../lib/executionPool");
const cache = require("../lib/cache");
const metrics = require("../lib/metrics");
const { requireApiKey } = require("../lib/auth");
const { checkAllToolchains } = require("../lib/toolchain");
const { version } = require("../package.json");

function publicBody() {
  const snapshot = metrics.getSnapshot();
  return {
    status: "ok",
    service: "execution-service",
    timestamp: new Date().toISOString(),
    version,
    ...snapshot,
  };
}

router.get("/health", (req, res) => {
  res.json(publicBody());
});

router.get("/health/details", requireApiKey, async (req, res) => {
  const toolchains = await checkAllToolchains();
  const jdkAvailable = toolchains.javac.available && toolchains.java.available;
  const allAvailable = Object.values(toolchains).every((t) => t.available);

  res.status(allAvailable ? 200 : 503).json({
    ...publicBody(),
    status: allAvailable ? "ok" : "degraded",
    jdk: { available: jdkAvailable, jdk: toolchains.javac },
    toolchains,
    execution: pool.getStats(),
    cache: cache.getStats(),
  });
});

module.exports = router;

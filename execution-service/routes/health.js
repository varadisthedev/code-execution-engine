const express = require("express");
const router = express.Router();
const os = require("os");

const pool = require("../lib/executionPool");
const { checkAllToolchains } = require("../lib/toolchain");

const round = (n) => Math.round(n * 100) / 100;

router.get("/health", async (req, res) => {
  const toolchains = await checkAllToolchains();
  const jdkAvailable = toolchains.javac.available && toolchains.java.available;
  const allAvailable = Object.values(toolchains).every((t) => t.available);

  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  res.status(allAvailable ? 200 : 503).json({
    service: "execution-service",
    jdk: { available: jdkAvailable, jdk: toolchains.javac },
    toolchains,
    execution: pool.getStats(),
    memory: {
      processRssMb: round(mem.rss / 1024 / 1024),
      systemTotalMb: round(totalMem / 1024 / 1024),
      systemFreeMb: round(freeMem / 1024 / 1024),
      systemUsedPercent: round(((totalMem - freeMem) / totalMem) * 100),
    },
    cpu: { cores: os.cpus().length, loadAvg1m: round(os.loadavg()[0]) },
    uptimeSeconds: Math.round(process.uptime()),
  });
});

module.exports = router;

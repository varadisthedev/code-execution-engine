const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const fs = require("fs").promises;
const os = require("os");
const path = require("path");

const pool = require("../lib/executionPool");
const cache = require("../lib/cache");
const sandbox = require("../lib/sandbox");
const { LANGUAGES } = require("../lib/languages");

const TMP_ROOT = process.env.EXEC_TMP_DIR || os.tmpdir();
const DEFAULT_TIMEOUT_MS = Number(process.env.DEFAULT_TIMEOUT_MS) || 5000;
const HARD_MAX_TIMEOUT_MS = Number(process.env.HARD_MAX_TIMEOUT_MS) || 15000;
const COMPILE_TIMEOUT_MS = Math.max(Number(process.env.COMPILE_TIMEOUT_MS) || 25000, 25000);

function resolveTimeout(requested) {
  const n = Number(requested);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(n, HARD_MAX_TIMEOUT_MS); // never trust the caller's number as-is
}

router.post("/execute", async (req, res) => {
  const { language, sourceCode, stdin, timeoutMs } = req.body || {};

  if (!LANGUAGES[language]) {
    return res.status(400).json({ error: "Unsupported language" });
  }
  if (!sourceCode || typeof sourceCode !== "string") {
    return res.status(400).json({ error: "sourceCode is required" });
  }

  const lang = LANGUAGES[language];
  const timeout = resolveTimeout(timeoutMs);

  console.log(
    `[execute] language=${language} sourceBytes=${Buffer.byteLength(sourceCode)} timeoutMs=${timeout} compileTimeoutMs=${COMPILE_TIMEOUT_MS}`
  );

  try {
    await pool.acquireSlot();
  } catch (busyError) {
    return res.status(503).json({ error: busyError.message });
  }

  // Compiled languages run out of a shared, hash-keyed cache dir (safe to
  // read/execute concurrently). Python has no compile step, so it always
  // gets a fresh per-request scratch dir instead.
  const scratchDir = lang.compiled ? null : path.join(TMP_ROOT, crypto.randomUUID());

  try {
    let runDir;
    let cacheHit;

    if (lang.compiled) {
      const compileFn = async (dir) => {
        await fs.writeFile(path.join(dir, lang.sourceFile), sourceCode);
        const result = await sandbox.run({
          command: lang.compile,
          cwd: dir,
          timeoutMs: COMPILE_TIMEOUT_MS,
        });
        if (result.timedOut) {
          return `Compilation timed out after ${COMPILE_TIMEOUT_MS}ms`;
        }
        if (result.exitCode !== 0) {
          return (result.stderr || result.stdout || "Compilation failed").trim();
        }
        return undefined;
      };

      const compiled = await cache.getOrCompile(language, sourceCode, compileFn);
      cacheHit = compiled.cacheHit;

      if (compiled.compileError) {
        return res.json({
          stdout: "",
          stderr: "",
          exitCode: null,
          timedOut: false,
          compileError: compiled.compileError,
          runtimeMs: 0,
          cacheHit,
        });
      }
      runDir = compiled.dir;
    } else {
      await fs.mkdir(scratchDir, { recursive: true });
      await fs.writeFile(path.join(scratchDir, lang.sourceFile), sourceCode);
      runDir = scratchDir;
    }

    const result = await sandbox.run({
      command: lang.run,
      cwd: runDir,
      stdin,
      timeoutMs: timeout,
      memoryLimitKb: lang.memoryLimitKb,
    });

    res.json({ ...result, compileError: undefined, cacheHit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    pool.releaseSlot();
    if (scratchDir) {
      await fs.rm(scratchDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

module.exports = router;

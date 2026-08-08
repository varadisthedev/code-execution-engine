const express = require("express");
const router = express.Router();
const { exec } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs").promises;
const path = require("path");

async function removeDir(dirPath) {
  if (typeof fs.rm === "function") {
    return fs.rm(dirPath, { recursive: true, force: true });
  }

  return fs.rmdir(dirPath, { recursive: true });
}

// Execute code with timeout
function executeCommand(command, timeout = 10000) {
  return new Promise((resolve) => {
    exec(command, { timeout }, (error, stdout, stderr) => {
      const output = stdout || "";
      const errorMessage = error && error.message ? error.message : "";
      const errorOutput = stderr || output || errorMessage || "";

      if (error) {
        if (error.killed) {
          resolve({
            success: false,
            error: "Time Limit Exceeded (>10 seconds)",
            output,
          });
        } else {
          resolve({
            success: false,
            error: errorOutput.trim(),
            output,
          });
        }
      } else {
        resolve({
          success: true,
          output,
          error: stderr || "",
        });
      }
    });
  });
}

// POST /api/execute/java
router.post("/java", async (req, res) => {
  const { code, input } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Code is required" });
  }

  const id = uuidv4();
  const workDir = path.join("/tmp", id);

  try {
    await fs.mkdir(workDir, { recursive: true });
    await fs.writeFile(path.join(workDir, "Main.java"), code);

    if (input) {
      await fs.writeFile(path.join(workDir, "input.txt"), input);
    }

    // Compile Java
    const compileResult = await executeCommand(
      `cd ${workDir} && javac Main.java 2>&1`,
    );

    if (!compileResult.success) {
      await removeDir(workDir);
      return res.json({
        success: false,
        error: "Compilation Error:\n" + compileResult.error,
        output: "",
      });
    }

    // Run Java
    const runCommand = input
      ? `cd ${workDir} && java Main < input.txt`
      : `cd ${workDir} && java Main`;

    const result = await executeCommand(runCommand);
    await removeDir(workDir);

    res.json(result);
  } catch (error) {
    await removeDir(workDir).catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

// POST /api/execute/cpp
router.post("/cpp", async (req, res) => {
  const { code, input } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Code is required" });
  }

  const id = uuidv4();
  const workDir = path.join("/tmp", id);

  try {
    await fs.mkdir(workDir, { recursive: true });
    await fs.writeFile(path.join(workDir, "main.cpp"), code);

    if (input) {
      await fs.writeFile(path.join(workDir, "input.txt"), input);
    }

    // Compile C++
    const compileResult = await executeCommand(
      `cd ${workDir} && g++ -std=c++17 -O2 main.cpp -o program 2>&1`,
    );

    if (!compileResult.success) {
      await removeDir(workDir);
      return res.json({
        success: false,
        error: "Compilation Error:\n" + compileResult.error,
        output: "",
      });
    }

    // Run C++
    const runCommand = input
      ? `cd ${workDir} && ./program < input.txt`
      : `cd ${workDir} && ./program`;

    const result = await executeCommand(runCommand);
    await removeDir(workDir);

    res.json(result);
  } catch (error) {
    await removeDir(workDir).catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

// POST /api/execute/python
router.post("/python", async (req, res) => {
  const { code, input } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Code is required" });
  }

  const id = uuidv4();
  const workDir = path.join("/tmp", id);

  try {
    await fs.mkdir(workDir, { recursive: true });
    await fs.writeFile(path.join(workDir, "main.py"), code);

    if (input) {
      await fs.writeFile(path.join(workDir, "input.txt"), input);
    }

    // Run Python
    const runCommand = input
      ? `cd ${workDir} && python3 main.py < input.txt`
      : `cd ${workDir} && python3 main.py`;

    const result = await executeCommand(runCommand);
    await removeDir(workDir);

    res.json(result);
  } catch (error) {
    await removeDir(workDir).catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

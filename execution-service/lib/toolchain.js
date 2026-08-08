const { execFile } = require("child_process");

function checkVersion(cmd) {
  return new Promise((resolve) => {
    execFile(cmd, ["--version"], { timeout: 3000 }, (error, stdout) => {
      if (error) return resolve({ available: false });
      resolve({ available: true, version: stdout.trim().split("\n")[0] });
    });
  });
}

async function checkAllToolchains() {
  const [python3, javac, java, gcc, gxx] = await Promise.all(
    ["python3", "javac", "java", "gcc", "g++"].map(checkVersion),
  );
  return { python3, javac, java, gcc, "g++": gxx };
}

module.exports = { checkAllToolchains };

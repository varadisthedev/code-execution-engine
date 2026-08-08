const { spawn, execFileSync } = require("child_process");

const IS_POSIX = process.platform !== "win32";
const MAX_BUFFER_CHARS = 2 * 1024 * 1024; // per stream, avoids unbounded RAM growth on runaway output

// Never inherit this process's own env (e.g. EXECUTION_SERVICE_API_KEY) into
// the sandboxed program — only pass through what the toolchains need.
const CHILD_ENV = {};
for (const key of ["PATH", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL", "JAVA_HOME"]) {
  if (process.env[key] !== undefined) CHILD_ENV[key] = process.env[key];
}

function killTree(child) {
  if (!child.pid) return;
  if (IS_POSIX) {
    // negative pid = kill the whole process group (child was spawned detached
    // as its own group leader), not just the top PID — a runaway program can
    // fork children of its own, and a bare kill(pid) would orphan them.
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // group may already be gone
    }
  } else {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    } catch {
      // already exited
    }
  }
}

function append(buf, chunk) {
  return buf.length < MAX_BUFFER_CHARS ? buf + chunk : buf;
}

// Runs `command` (a shell string) inside cwd, piping stdin and enforcing a
// hard wall-clock timeout. On POSIX, memoryLimitKb applies `ulimit -v` and
// the command runs via `exec` so the shell process is replaced in place —
// same pid, same process group, so killTree reliably reaches the real work.
function run({ command, cwd, stdin, timeoutMs, memoryLimitKb }) {
  const shellCommand = IS_POSIX
    ? `${memoryLimitKb ? `ulimit -v ${memoryLimitKb}; ` : ""}exec ${command}`
    : command;

  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(shellCommand, {
      cwd,
      shell: true,
      detached: IS_POSIX,
      env: CHILD_ENV,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);

    const finish = (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode, timedOut, runtimeMs: Date.now() - start });
    };

    child.stdout.on("data", (d) => (stdout = append(stdout, d)));
    child.stderr.on("data", (d) => (stderr = append(stderr, d)));
    child.on("error", (err) => {
      stderr = stderr || err.message;
      finish(null);
    });
    child.on("close", (code) => finish(code));

    child.stdin.on("error", () => {}); // EPIPE if the process exits before reading stdin
    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
  });
}

module.exports = { run, IS_POSIX };

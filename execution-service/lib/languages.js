const { IS_POSIX } = require("./sandbox");

const NATIVE_MEMORY_LIMIT_KB = Number(process.env.EXEC_MEMORY_LIMIT_KB) || 256 * 1024;
// The JVM reserves large virtual address space on startup regardless of
// actual usage, so ulimit -v breaks it — cap the heap directly instead.
const JAVA_MAX_HEAP_MB = Number(process.env.JAVA_MAX_HEAP_MB) || 256;

const nativeRunCommand = IS_POSIX ? "./program" : ".\\program.exe";

const LANGUAGES = {
  python: {
    sourceFile: "main.py",
    compiled: false,
    run: "python3 main.py",
    memoryLimitKb: NATIVE_MEMORY_LIMIT_KB,
  },
  java: {
    sourceFile: "Main.java",
    compiled: true,
    compile: "javac --release 17 Main.java",
    run: `java -Xmx${JAVA_MAX_HEAP_MB}m -Xss512k -cp . Main`,
  },
  cpp: {
    sourceFile: "main.cpp",
    compiled: true,
    compile: "g++ -O2 -std=c++17 main.cpp -o program",
    run: nativeRunCommand,
    memoryLimitKb: NATIVE_MEMORY_LIMIT_KB,
  },
  c: {
    sourceFile: "main.c",
    compiled: true,
    compile: "gcc -O2 main.c -o program -lm",
    run: nativeRunCommand,
    memoryLimitKb: NATIVE_MEMORY_LIMIT_KB,
  },
};

module.exports = { LANGUAGES };

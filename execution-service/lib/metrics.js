const fs = require("fs");
const os = require("os");

const SAMPLE_MS = 1000;
const UNLIMITED_CGROUP_LIMIT = 1n << 60n; // v1 reports a huge number when uncapped

const round = (n) => Math.round(n * 100) / 100;
const bytesToMb = (n) => round(Number(n) / 1024 / 1024);

function cpuTimes() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const t of Object.values(cpu.times)) total += t;
    idle += cpu.times.idle;
  }
  return { idle, total };
}

let prevCpu = cpuTimes();
let usagePercent = null;
let sampler = null;

function sampleCpu() {
  const now = cpuTimes();
  const idleDelta = now.idle - prevCpu.idle;
  const totalDelta = now.total - prevCpu.total;
  prevCpu = now;
  if (totalDelta > 0) {
    usagePercent = round((1 - idleDelta / totalDelta) * 100);
  }
}

function start() {
  if (sampler) return;
  sampleCpu();
  sampler = setInterval(sampleCpu, SAMPLE_MS);
  sampler.unref();
}

function readCgroupFile(path) {
  try {
    return fs.readFileSync(path, "utf8").trim();
  } catch {
    return null;
  }
}

function parseCgroupBytes(raw) {
  if (raw == null || raw === "max") return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function readCgroupMemory() {
  const v2Usage = parseCgroupBytes(readCgroupFile("/sys/fs/cgroup/memory.current"));
  const v2Limit = parseCgroupBytes(readCgroupFile("/sys/fs/cgroup/memory.max"));
  if (v2Usage != null) {
    return { usageBytes: v2Usage, limitBytes: v2Limit };
  }

  const v1Usage = parseCgroupBytes(readCgroupFile("/sys/fs/cgroup/memory/memory.usage_in_bytes"));
  const v1Limit = parseCgroupBytes(readCgroupFile("/sys/fs/cgroup/memory/memory.limit_in_bytes"));
  if (v1Usage != null) {
    const limitBytes = v1Limit != null && v1Limit < UNLIMITED_CGROUP_LIMIT ? v1Limit : null;
    return { usageBytes: v1Usage, limitBytes };
  }

  return null;
}

function getSnapshot() {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const [load1, load5, load15] = os.loadavg();

  const memory = {
    processRssMb: bytesToMb(mem.rss),
    processHeapUsedMb: bytesToMb(mem.heapUsed),
    processHeapTotalMb: bytesToMb(mem.heapTotal),
    systemTotalMb: bytesToMb(totalMem),
    systemFreeMb: bytesToMb(freeMem),
    systemUsedPercent: round(((totalMem - freeMem) / totalMem) * 100),
    cgroup: null,
  };

  const cgroup = readCgroupMemory();
  if (cgroup) {
    const usageMb = bytesToMb(cgroup.usageBytes);
    const limitMb = cgroup.limitBytes != null ? bytesToMb(cgroup.limitBytes) : null;
    memory.cgroup = {
      usageMb,
      limitMb,
      usedPercent: limitMb ? round((usageMb / limitMb) * 100) : null,
    };
  }

  return {
    memory,
    cpu: {
      cores: os.cpus().length,
      usagePercent,
      loadAvg: [round(load1), round(load5), round(load15)],
    },
    uptimeSeconds: Math.round(process.uptime()),
    node: process.version,
  };
}

module.exports = { start, getSnapshot };

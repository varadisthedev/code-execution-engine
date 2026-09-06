// Caps how many compiles/runs happen at once so a burst of requests can't
// OOM the shared container (no per-request isolation anymore on Render free).
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_EXECUTIONS) || 2;
const MAX_QUEUE = Number(process.env.MAX_QUEUED_EXECUTIONS) || 10;

let active = 0;
const queue = [];

function acquireSlot() {
  return new Promise((resolve, reject) => {
    if (active < MAX_CONCURRENT) {
      active++;
      return resolve();
    }
    if (queue.length >= MAX_QUEUE) {
      return reject(new Error("Server busy, try again shortly"));
    }
    queue.push(resolve);
  });
}

function releaseSlot() {
  active--;
  const next = queue.shift();
  if (next) {
    active++;
    next();
  }
}

function getStats() {
  return { active, queued: queue.length, maxConcurrent: MAX_CONCURRENT, maxQueue: MAX_QUEUE };
}

module.exports = { acquireSlot, releaseSlot, getStats };

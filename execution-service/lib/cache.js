const crypto = require("crypto");
const fs = require("fs").promises;
const os = require("os");
const path = require("path");

const CACHE_DIR = process.env.CACHE_DIR || path.join(os.tmpdir(), "exec-cache");
const TTL_MS = Number(process.env.CACHE_TTL_MS) || 15 * 60 * 1000;
const MAX_ENTRIES = Number(process.env.CACHE_MAX_ENTRIES) || 40;

// hash -> { promise: Promise<{dir, compileError}>, lastAccess }
const store = new Map();

function hashOf(language, sourceCode) {
  return crypto.createHash("sha256").update(language).update("\0").update(sourceCode).digest("hex");
}

async function dropEntry(hash) {
  store.delete(hash);
  await fs.rm(path.join(CACHE_DIR, hash), { recursive: true, force: true }).catch(() => {});
}

async function evict() {
  const now = Date.now();
  for (const [hash, entry] of store) {
    if (now - entry.lastAccess > TTL_MS) await dropEntry(hash);
  }
  while (store.size > MAX_ENTRIES) {
    let oldestHash = null;
    let oldestAccess = Infinity;
    for (const [hash, entry] of store) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestHash = hash;
      }
    }
    if (!oldestHash) break;
    await dropEntry(oldestHash);
  }
}

async function compileAndStore(hash, dir, compileFn) {
  try {
    await fs.mkdir(dir, { recursive: true });
    const compileError = await compileFn(dir);
    evict().catch(() => {}); // housekeeping, doesn't block the response
    return { dir, compileError: compileError || undefined };
  } catch (err) {
    // an infra failure (disk error, etc) isn't a compile outcome — don't cache it
    store.delete(hash);
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

// Returns { dir, compileError, cacheHit }. compileFn(dir) writes the source
// into dir, runs the compiler, and resolves to a compileError string (or
// undefined on success). Concurrent calls with the same hash share one
// in-flight compile — the store.get/store.set below has no `await` between
// them, so two requests arriving back-to-back can't both trigger a compile.
function getOrCompile(language, sourceCode, compileFn) {
  const hash = hashOf(language, sourceCode);
  const existing = store.get(hash);

  if (existing) {
    existing.lastAccess = Date.now();
    return existing.promise.then((result) => ({ ...result, cacheHit: true }));
  }

  const dir = path.join(CACHE_DIR, hash);
  const promise = compileAndStore(hash, dir, compileFn);
  store.set(hash, { promise, lastAccess: Date.now() });
  return promise.then((result) => ({ ...result, cacheHit: false }));
}

// Don't trust a cache directory left over from a previous container
// filesystem layer — the in-memory index always starts empty on boot anyway,
// so any leftover files on disk would just be unreachable, unevictable waste.
async function resetOnBoot() {
  store.clear();
  await fs.rm(CACHE_DIR, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function getStats() {
  return { entries: store.size, maxEntries: MAX_ENTRIES };
}

module.exports = { getOrCompile, resetOnBoot, getStats };

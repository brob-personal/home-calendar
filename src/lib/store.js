/*
  ============================================================================
  STORAGE — R3, backlog item 3
  ----------------------------------------------------------------------------
  "Swap store from window.storage to localStorage behind the same async
  interface. Both current bodies swallow errors silently — surface failures
  instead so a broken board is visible rather than mysteriously amnesiac."

  What was here before called `window.storage`, an artifact-host API that
  exists in no browser. Every call fell into an empty catch, so the board ran
  from memory and forgot everything on reload, silently. The interface is
  unchanged — `async get(key)`, `async set(key, value)` — so no caller had to
  change shape; what changed is the three things behind it.

  1. localStorage, not window.storage. Synchronous underneath, still async at
     the seam. Keeping the promises means the seam survives a later swap to
     IndexedDB (a board with months of notes and photo caches is a plausible
     reason to want one) without touching a single caller.

  2. Dates survive. Values go through ./contracts/serialize.js, so an Event's
     `start` comes back as a live Date rather than the ISO string JSON.parse
     would have handed back. This is what unblocked the event cache — Defect
     #13.

  3. Failures are thrown, not eaten. Quota exhaustion, a disabled storage
     partition, a blob corrupted by a half-finished write: each surfaces as a
     StorageError carrying its operation, key and cause. Callers decide what
     to show — useBoardData collects them into `storageError` for R12's
     failure UI — but nothing can lose data quietly any more.

  The `board:` namespace is preserved from the prototype. It is not decoration:
  localStorage is shared across the whole origin, and a preview deployment on
  the same host as something else must not collide.
  ============================================================================
*/
import { SCHEMA_VERSION } from "../contracts/schema.js";
import { fromJSON, toJSON } from "../contracts/serialize.js";

export const NAMESPACE = "board:";

/**
 * A storage operation that did not happen. Carries enough to report and to
 * debug: which operation, which key, and the underlying DOMException.
 *
 * `code` is the coarse reason, for callers that want to branch:
 *   "unavailable" — no localStorage at all (disabled, partitioned, sandboxed)
 *   "quota"       — the write did not fit
 *   "corrupt"     — something is stored under that key but it is not ours
 *   "io"          — anything else the platform threw
 */
export class StorageError extends Error {
  constructor(message, { op, key, code, cause } = {}) {
    super(message);
    this.name = "StorageError";
    this.op = op;
    this.key = key;
    this.code = code || "io";
    this.cause = cause;
  }
}

/*
  Reading `globalThis.localStorage` can itself throw — Safari with cookies
  fully blocked raises a SecurityException on property access, not on use — so
  even the lookup is guarded. Resolved per call rather than cached at module
  load so a test can stub it and so a permission that changes mid-session is
  picked up.
*/
function backend() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Is persistence usable at all? Sync, cheap, and non-throwing — for a caller
 * that wants to degrade before attempting a write rather than after.
 *
 * A present-but-broken localStorage (quota 0, which private browsing has
 * shipped as) reports available and fails on write. That is the honest answer:
 * reads work, writes do not, and only the write can tell you.
 *
 * @returns {boolean}
 */
export function isAvailable() {
  return backend() !== null;
}

function requireBackend(op, key) {
  const ls = backend();
  if (!ls) {
    throw new StorageError(
      "localStorage is unavailable — the board will run from memory and forget everything on reload.",
      { op, key, code: "unavailable" },
    );
  }
  return ls;
}

/*
  The persisted envelope. Every write is stamped, which is what lets migrate()
  know what it is looking at (PLAN.md §R3 item 1: "add a schemaVersion to
  persisted blobs").

    { v: 1, at: "2026-09-09T18:04:00.000Z", data: <the slice> }

  `at` is written for the runbook, not for the app: when a board is stale, the
  first question is how stale, and R14's recovery notes need an answer that
  does not depend on the app still working.

  An unwrapped value — anything written before this envelope existed — is
  treated as version 0 data, which is exactly what migrate() expects. That is
  how a pre-R3 blob loads without loss.
*/
function unwrap(parsed) {
  const wrapped =
    Boolean(parsed) && typeof parsed === "object" && !Array.isArray(parsed) && "data" in parsed;
  return wrapped
    ? { version: Number.isFinite(Number(parsed.v)) ? Number(parsed.v) : 0, data: parsed.data }
    : { version: 0, data: parsed };
}

function readEnvelope(key, op) {
  const ls = requireBackend(op, key);
  let text;
  try {
    text = ls.getItem(NAMESPACE + key);
  } catch (cause) {
    throw new StorageError(`Could not read "${key}" from storage.`, {
      op,
      key,
      code: "io",
      cause,
    });
  }
  if (text === null || text === undefined) return null;

  try {
    return unwrap(fromJSON(text));
  } catch (cause) {
    /*
      Deliberately not self-healing. Deleting the key here would turn a
      diagnosable corruption into an amnesiac board that looks fine — the exact
      failure mode this rewrite exists to end. The caller reports it; a human
      clears it with store.remove().
    */
    throw new StorageError(`Stored value for "${key}" is not readable board data.`, {
      op,
      key,
      code: "corrupt",
      cause,
    });
  }
}

export const store = {
  /**
   * Read one slice. `null` means nothing was ever written under that key —
   * a first run — which is different from a stored value that failed to parse
   * (that throws).
   *
   * @param {string} key
   * @returns {Promise<unknown|null>}
   */
  async get(key) {
    const envelope = readEnvelope(key, "get");
    return envelope ? envelope.data : null;
  },

  /**
   * The schema version a slice was written at, or `null` if the key is empty.
   * migrate() keys its version steps off this.
   *
   * Per-key rather than board-wide because the three write-through effects in
   * useBoardData persist independently: a board interrupted mid-upgrade can
   * genuinely hold settings at version 2 and notes at version 1, and pretending
   * otherwise would run a step twice or skip one.
   *
   * @param {string} key
   * @returns {Promise<number|null>}
   */
  async versionOf(key) {
    const envelope = readEnvelope(key, "versionOf");
    return envelope ? envelope.version : null;
  },

  /**
   * Write one slice, stamped with the current schema version. Throws
   * StorageError rather than returning a status: a failed write is not a
   * normal outcome, and the old silent catch is precisely the bug.
   *
   * @param {string} key
   * @param {unknown} value
   * @returns {Promise<void>}
   */
  async set(key, value) {
    const ls = requireBackend("set", key);
    let text;
    try {
      text = toJSON({ v: SCHEMA_VERSION, at: new Date().toISOString(), data: value });
    } catch (cause) {
      /* A cyclic object or a BigInt. A contract shape cannot contain either,
         so this is a caller bug and says so. */
      throw new StorageError(`Value for "${key}" cannot be serialized.`, {
        op: "set",
        key,
        code: "io",
        cause,
      });
    }

    try {
      ls.setItem(NAMESPACE + key, text);
    } catch (cause) {
      /*
        Quota is the realistic failure on a board that runs for months: notes
        accumulate strokes and R9 will cache photo URLs. Named separately so
        R12's UI can say "storage is full" rather than "storage failed", and so
        a soak run can assert which one it hit.
      */
      const quota =
        cause?.name === "QuotaExceededError" ||
        cause?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        cause?.code === 22;
      throw new StorageError(
        quota
          ? `Storage is full — "${key}" was not saved.`
          : `Could not write "${key}" to storage.`,
        { op: "set", key, code: quota ? "quota" : "io", cause },
      );
    }
  },

  /**
   * Drop one slice. The recovery path for a corrupt blob, and R14's backup and
   * restore notes lean on it.
   *
   * @param {string} key
   * @returns {Promise<void>}
   */
  async remove(key) {
    const ls = requireBackend("remove", key);
    try {
      ls.removeItem(NAMESPACE + key);
    } catch (cause) {
      throw new StorageError(`Could not remove "${key}" from storage.`, {
        op: "remove",
        key,
        code: "io",
        cause,
      });
    }
  },
};

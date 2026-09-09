// R4 — env var access for the serverless API. Fails loud: a missing secret
// should surface as a 500 with a clear name, not a mysterious fetch failure
// three calls deep.

/** @returns {string} */
export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

/** @returns {string|undefined} */
export function optionalEnv(name) {
  return process.env[name] || undefined;
}

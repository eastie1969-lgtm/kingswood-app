"use strict";
// Draft: disabled until separately approved and enabled in production.
const crypto = require("node:crypto");
const ISSUER = "https://token.actions.githubusercontent.com";
const JWKS = `${ISSUER}/.well-known/jwks`;
const REPOSITORY = "eastie1969-lgtm/ark-daily-report";
const WORKFLOW = `${REPOSITORY}/.github/workflows/revolut-alert.yml@refs/heads/main`;

function createRevolutAutomationAuth({ audience, enabled = false, now = Date.now, fetchKeys } = {}) {
  let cached = null;
  let expires = 0;
  async function keys() {
    if (fetchKeys) return fetchKeys(); // Dependency injection for offline tests only.
    if (cached && now() < expires) return cached;
    const response = await fetch(JWKS, { signal: AbortSignal.timeout(5000), redirect: "error" });
    if (!response.ok) throw new Error("OIDC key service unavailable");
    const body = await response.json();
    if (!Array.isArray(body.keys)) throw new Error("Invalid signing keys");
    cached = body.keys;
    expires = now() + 60000;
    return cached;
  }
  return async function authenticate(request) {
    if (!enabled || !audience) return { ok: false, status: 503 };
    try {
      const header = request.headers.authorization;
      if (typeof header !== "string" || !header.startsWith("Bearer ")) return { ok: false, status: 401 };
      const token = header.slice(7);
      if (token.length > 16384) return { ok: false, status: 401 };
      const parts = token.split(".");
      if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) return { ok: false, status: 401 };
      const protectedHeader = JSON.parse(Buffer.from(parts[0], "base64url").toString());
      if (protectedHeader.alg !== "RS256" || typeof protectedHeader.kid !== "string" || protectedHeader.crit) return { ok: false, status: 401 };
      const key = (await keys()).find(k => k.kid === protectedHeader.kid && k.kty === "RSA" && (!k.alg || k.alg === "RS256") && (!k.use || k.use === "sig"));
      if (!key || !crypto.verify("RSA-SHA256", Buffer.from(parts[0] + "." + parts[1]), crypto.createPublicKey({ key, format: "jwk" }), Buffer.from(parts[2], "base64url"))) return { ok: false, status: 401 };
      const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      const t = Math.floor(now() / 1000);
      if (![claims.exp, claims.iat, claims.nbf].every(Number.isFinite) || claims.exp <= t || claims.nbf > t + 30 || claims.iat > t + 30 || claims.iat < t - 600 || claims.exp - claims.iat > 600) return { ok: false, status: 401 };
      if (claims.iss !== ISSUER || claims.aud !== audience || ![`repo:${REPOSITORY}:ref:refs/heads/main`, "repo:eastie1969-lgtm@295796504/ark-daily-report@1325029173:ref:refs/heads/main"].includes(claims.sub) || claims.repository !== REPOSITORY || claims.repository_id !== "1325029173" || claims.repository_owner_id !== "295796504" || claims.ref !== "refs/heads/main" || claims.workflow_ref !== WORKFLOW || !["schedule", "workflow_dispatch", "push"].includes(claims.event_name)) return { ok: false, status: 403 };
      return { ok: true };
    } catch {
      // Never disclose tokens, claim bodies, signatures or upstream errors.
      return { ok: false, status: 401 };
    }
  };
}
module.exports = { createRevolutAutomationAuth };

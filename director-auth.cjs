"use strict";
const crypto = require("crypto");

const COOKIE = "kw_phase10_director_session";
const TTL = 30 * 60 * 1000;
const FAILURE_WINDOW = 15 * 60 * 1000;
const NAMES = new Set(["Kevin", "Alex"]);
const digest = (value) => crypto.createHash("sha256").update(String(value)).digest();
const equal = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

function createDirectorAuth({ credentials, contextForName, production = false, now = Date.now }) {
  const sessions = new Map();
  const failures = new Map();
  function sessionId(request) {
    const match = String(request.headers.cookie || "").split(";").map(v => v.trim())
      .find(v => v.startsWith(COOKIE + "="));
    try { return match ? decodeURIComponent(match.slice(COOKIE.length + 1)) : ""; } catch { return ""; }
  }
  function cookie(id, maxAge = TTL / 1000) {
    return `${COOKIE}=${encodeURIComponent(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${production ? "; Secure" : ""}`;
  }
  function logout(request) { sessions.delete(sessionId(request)); }
  function session(request) {
    const id = sessionId(request);
    const value = sessions.get(id);
    if (!value || value.expires <= now()) {
      sessions.delete(id);
      return { ok: false, status: 401, message: "Please sign in with your director PIN." };
    }
    const context = contextForName(value.context.displayName);
    if (!context || context.role !== "Director" || context.staffId !== value.context.staffId) {
      sessions.delete(id);
      return { ok: false, status: 403, message: "Director access is not available for this account." };
    }
    return { ok: true, session: { ...value, context } };
  }
  function login(request, payload) {
    const name = typeof payload.name === "string" ? payload.name : "";
    const key = NAMES.has(name) ? name : "unknown";
    const failure = failures.get(key);
    if (failure && failure.until > now() && failure.count >= 5) {
      return { ok: false, status: 429, message: "Too many sign-in attempts. Please try again in 15 minutes." };
    }
    const expected = NAMES.has(name) ? credentials[name] : "";
    const configured = typeof expected === "string" && /^[0-9]{8,64}$/.test(expected);
    const supplied = typeof payload.pin === "string" ? payload.pin : "";
    const valid = configured && /^[0-9]{8,64}$/.test(supplied) && equal(expected, supplied);
    const context = valid ? contextForName(name) : null;
    if (!valid || !context || context.role !== "Director") {
      const current = failure && failure.until > now() ? failure : { count: 0, until: now() + FAILURE_WINDOW };
      failures.set(key, { ...current, count: current.count + 1 });
      return { ok: false, status: 403, message: "Name or director PIN not recognised." };
    }
    failures.delete(key);
    logout(request);
    for (const [id, entry] of sessions) if (entry.expires <= now()) sessions.delete(id);
    // Bound memory while allowing multiple legitimate devices.
    if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value);
    const id = crypto.randomBytes(32).toString("base64url");
    const value = {
      sessionId: id, context, csrfToken: crypto.randomBytes(32).toString("base64url"),
      expires: now() + TTL, expiresAt: new Date(now() + TTL).toISOString()
    };
    sessions.set(id, value);
    return { ok: true, session: value, setCookie: cookie(id) };
  }
  function csrf(request, value) {
    const token = request.headers["x-csrf-token"];
    return typeof token === "string" && equal(token, value.csrfToken);
  }
  return { login, session, logout, cookie, csrf };
}

function isDirectorRoute(pathname) {
  return pathname.startsWith("/api/phase-10/") || pathname.startsWith("/api/revolut/");
}

function sameOrigin(request, configuredOrigin) {
  const origin = request.headers.origin;
  let expected;
  try { expected = new URL(configuredOrigin || `http://${request.headers.host}`).origin; } catch { return false; }
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  if (origin && origin !== expected) return false;
  // Browser mutations must carry an exact Origin, including sign-in and sign-out.
  return ["GET", "HEAD", "OPTIONS"].includes(request.method) || origin === expected;
}

module.exports = { createDirectorAuth, isDirectorRoute, sameOrigin, TTL };


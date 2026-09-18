// Shared session guard + cookie handling (ticket 05): "is this request
// authenticated" had eight near-copies; it now has one implementation.
//
// The guard moved here verbatim from auth.js — same cookie name, same TTL,
// same JOIN, same expiry rule, same 401 body `{ error: 'Sesi tidak valid.
// Silakan login.' }`. Do not reword that string.
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { first, run, dbOf } from "./db.js";
import { fail } from "./respond.js";

export const SESSION_COOKIE = "nava_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const SESSION_INVALID = "Sesi tidak valid. Silakan login.";

const te = new TextEncoder();
const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function hashPassword(password, salt) {
  const digest = await crypto.subtle.digest(
    "sha-256",
    te.encode(salt + ":" + password),
  );
  return toHex(digest);
}

export const randomId = () =>
  [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const cookieOpts = (c) => {
  let secure = false;
  try {
    // Local dev serves http; production is always https.
    secure = new URL(c.req.url).protocol === "https:";
  } catch {
    secure = false;
  }
  return {
    path: "/",
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    sameSite: "Lax",
    secure,
  };
};

// Guard for every /api/* route except /api/auth/login.
export const requireSession = createMiddleware(async (c, next) => {
  const sid = getCookie(c, SESSION_COOKIE);
  if (!sid) return fail(c, SESSION_INVALID, 401);
  const row = await first(
    dbOf(c),
    "SELECT sessions.admin_id, sessions.expires_at, admins.username FROM sessions JOIN admins ON admins.id = sessions.admin_id WHERE sessions.id = ?",
    sid,
  );
  if (!row || Date.parse(row.expires_at) < Date.now()) {
    if (row) await run(dbOf(c), "DELETE FROM sessions WHERE id = ?", sid);
    return fail(c, SESSION_INVALID, 401);
  }
  c.set("adminId", row.admin_id);
  await next();
});

// Establish a session for an admin id and return the cookie value.
export async function startSession(c, adminId) {
  const sid = randomId();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_SECONDS * 1000,
  ).toISOString();
  await run(
    dbOf(c),
    "INSERT INTO sessions (id, admin_id, expires_at) VALUES (?, ?, ?)",
    sid,
    adminId,
    expiresAt,
  );
  setCookie(c, SESSION_COOKIE, sid, cookieOpts(c));
  return sid;
}

// Drop the session row (if any) and expire the cookie with mirrored flags.
export async function endSession(c) {
  const sid = getCookie(c, SESSION_COOKIE);
  if (sid) await run(dbOf(c), "DELETE FROM sessions WHERE id = ?", sid);
  // Must mirror the flags the cookie was set with, or the browser keeps it.
  const { httpOnly, sameSite, secure } = cookieOpts(c);
  deleteCookie(c, SESSION_COOKIE, { path: "/", httpOnly, sameSite, secure });
}

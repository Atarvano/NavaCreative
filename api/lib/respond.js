// Shared JSON response envelope (ticket 05): every route answered with the
// same two shapes but spelled them out by hand.
//
//   success: c.json(payload)            or  c.json(payload, 201)
//   error:   c.json({ error: msg }, s)  with s in { 400, 401, 404, 409 }
//
// These wrappers are deliberate one-liners over `c.json`. They do not touch
// the status code, the error string or the payload — the exact bytes Hono
// emitted before are the exact bytes it emits now.

// 200 success (or an explicit status for 201 creates).
export const ok = (c, payload, status = 200) => c.json(payload, status);

// Error envelope. The message is passed through verbatim; several are
// Indonesian strings and must not be reworded.
export const fail = (c, message, status) => c.json({ error: message }, status);

// The one fixed error that is not route-specific: the app-level 404.
export const notFound = (c) => fail(c, 'Tidak ditemukan.', 404);

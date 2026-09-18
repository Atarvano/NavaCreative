// Wrappers do not change bytes Hono emitted.

// 200 success (or an explicit status for 201 creates).
export const ok = (c, payload, status = 200) => c.json(payload, status);

// Error envelope. The message is passed through verbatim; several are
// Indonesian strings and must not be reworded.
export const fail = (c, message, status) => c.json({ error: message }, status);

// The one fixed error that is not route-specific: the app-level 404.
export const notFound = (c) => fail(c, 'Tidak ditemukan.', 404);

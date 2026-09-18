// Shared D1 access (ticket 05): the `prepare -> bind -> first/all/run` idiom
// was re-derived in every router. It now has one home.
//
// ponytail: thin wrappers only — no retry, no caching, no transaction, no
// rewriting of SQL text. Every call returns the raw D1 result (`null`,
// `{ results }`, `{ meta }`), so no route's status code or body can shift.
//
// The helpers take a D1 handle, not the request context, so the same three
// functions serve route handlers (`dbOf(c)`) and the per-entity helpers such
// as withModal / withRows / withBayar (which already receive `db`).

// The D1 binding from a Hono context.
export const dbOf = (c) => c.env.DB;

// First row, or null when the query matches nothing.
export const first = (db, sql, ...args) => db.prepare(sql).bind(...args).first();

// All rows, as D1 returns them: `{ results }`.
export const all = (db, sql, ...args) => db.prepare(sql).bind(...args).all();

// A write, as D1 returns it: `{ meta }` (callers read `meta.last_row_id`).
export const run = (db, sql, ...args) => db.prepare(sql).bind(...args).run();

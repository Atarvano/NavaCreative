// Thin wrappers, no retry/caching/transaction.
// Takes a D1 handle, not request context.
export const dbOf = (c) => c.env.DB;

// First row, or null when the query matches nothing.
export const first = (db, sql, ...args) => db.prepare(sql).bind(...args).first();

// All rows, as D1 returns them: `{ results }`.
export const all = (db, sql, ...args) => db.prepare(sql).bind(...args).all();

// A write, as D1 returns it: `{ meta }` (callers read `meta.last_row_id`).
export const run = (db, sql, ...args) => db.prepare(sql).bind(...args).run();

// Seed the single admin with a one-time password (Q10, ticket #40).
// Usage: ADMIN_SEED_PASSWORD=... node scripts/seed-admin.mjs <db-file>
// The password is hashed with WebCrypto SHA-256(salt + password), the same
// shape api/auth.js verifies. must_change_password=1 forces rotation.
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

const password = process.env.ADMIN_SEED_PASSWORD;
const dbFile = process.argv[2];
if (!password || !dbFile) {
  console.error('Usage: ADMIN_SEED_PASSWORD=... node scripts/seed-admin.mjs <db-file>');
  process.exit(1);
}

const salt = toHex(webcrypto.getRandomValues(new Uint8Array(16)));
const hash = toHex(
  await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`)),
);
const sql = `INSERT INTO admins (username, password_hash, password_salt, must_change_password) VALUES ('admin', '${hash}', '${salt}', 1);`;
const { execSync } = await import('node:child_process');
// sqlite3 CLI if present, else print the SQL for wrangler d1 execute.
try {
  execSync(`sqlite3 ${JSON.stringify(dbFile)} ${JSON.stringify(sql)}`, { stdio: 'inherit' });
  console.log('ok   admin seeded (must_change_password=1)');
} catch {
  console.log('-- sqlite3 CLI missing; run this yourself:');
  console.log(sql);
}

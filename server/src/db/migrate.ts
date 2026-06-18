import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postgres from 'postgres';
import { buildConfig } from '../config.js';

/**
 * Applies pending *.sql files from the migrations directory in lexical order.
 * Tracks applied files in schema_migrations. Idempotent across runs.
 * Each file runs in its own transaction.
 */
async function migrate(): Promise<void> {
  const config = buildConfig();
  const sql = postgres(config.db.url, { max: 1 });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Prefer migrations sitting next to this module (tsx running
    // src/db/migrate.ts locally finds src/db/migrations). Fall back to the
    // cwd-relative layout used by the Docker image, where the SQL files are
    // copied to /app/db/migrations and the process runs from /app.
    const moduleMigrations = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
    const dir = existsSync(moduleMigrations)
      ? moduleMigrations
      : path.resolve(process.cwd(), 'db/migrations');
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const [applied] = await sql<{ filename: string }[]>`
        SELECT filename FROM schema_migrations WHERE filename = ${file}
      `;
      if (applied) {
        console.log(`skip ${file} (already applied)`);
        continue;
      }

      await sql.begin(async (tx) => {
        await tx.file(path.join(dir, file));
        await tx`INSERT INTO schema_migrations (filename) VALUES (${file})`;
      });
      console.log(`applied ${file}`);
    }

    console.log('migrations done');
  } finally {
    await sql.end();
  }
}

migrate().catch((err: unknown) => {
  console.error('migration failed:', err);
  process.exit(1);
});

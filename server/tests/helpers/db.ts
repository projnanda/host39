import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSql } from '../../src/db/client.js';

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/db/migrations');

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

/** Drops everything and re-applies migrations (optionally only those before `stopBefore`). */
export async function resetDb(stopBefore?: string): Promise<void> {
  const sql = getSql();
  await sql.unsafe('SET client_min_messages = warning; DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  for (const file of migrationFiles()) {
    if (stopBefore && file >= stopBefore) break;
    await applyMigration(file);
  }
}

export async function applyMigration(file: string): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx.file(path.join(MIGRATIONS_DIR, file));
  });
}

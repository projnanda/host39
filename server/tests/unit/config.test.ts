import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emailConfigError } from '../../src/config.js';

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('emailConfigError: production requires RESEND_API_KEY', () => {
  assert.match(emailConfigError('production', '') ?? '', /RESEND_API_KEY/);
  assert.equal(emailConfigError('production', 're_x'), null);
  assert.equal(emailConfigError('development', ''), null);
  assert.equal(emailConfigError('test', ''), null);
});

test('buildConfig exits at startup in production when RESEND_API_KEY is missing', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '-e', "import('./src/config.ts').then((m) => { m.buildConfig(); console.log('NO_EXIT'); })"],
    {
      cwd: SERVER_DIR,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://unused',
        JWT_SECRET: 'a-production-secret-0123456789',
        RESEND_API_KEY: '',
      },
    },
  );
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /FATAL: .*RESEND_API_KEY/);
  assert.doesNotMatch(result.stdout, /NO_EXIT/);
});

/**
 * Reads a required env var.
 * Prints FATAL to stderr and exits with code 1 if the variable is
 * missing or blank.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    console.error(`FATAL: missing required env var: ${key}`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') return fallback;
  return value;
}

function parsePositiveInt(key: string, raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`FATAL: env var ${key} must be a positive integer (got "${raw}")`);
    process.exit(1);
  }
  return n;
}

export interface Config {
  readonly port: number;
  readonly nodeEnv: string;
  readonly db: {
    readonly url: string;
    readonly maxConnections: number;
  };
  readonly jwt: {
    readonly secret: string;
    readonly expiresIn: string;
  };
  readonly frontendUrl: string;
  readonly publicBaseUrl: string;
}

const DEV_JWT_SECRET = 'host39-dev-secret-change-in-production';
const MIN_JWT_SECRET_LENGTH = 16;

export function buildConfig(): Config {
  const nodeEnv = optionalEnv('NODE_ENV', 'development');
  const jwtSecret = optionalEnv('JWT_SECRET', DEV_JWT_SECRET);

  if (nodeEnv === 'production') {
    if (jwtSecret === DEV_JWT_SECRET) {
      console.error('FATAL: JWT_SECRET must be set in production');
      process.exit(1);
    }
    if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
      console.error(`FATAL: JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production`);
      process.exit(1);
    }
  }

  return {
    port: parsePositiveInt('PORT', optionalEnv('PORT', '3010')),
    nodeEnv,
    db: {
      url: requireEnv('DATABASE_URL'),
      maxConnections: parsePositiveInt('DB_MAX_CONNECTIONS', optionalEnv('DB_MAX_CONNECTIONS', '10')),
    },
    jwt: {
      secret: jwtSecret,
      expiresIn: optionalEnv('JWT_EXPIRES_IN', '7d'),
    },
    frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:3002'),
    publicBaseUrl: optionalEnv('PUBLIC_BASE_URL', 'http://localhost:3010'),
  };
}

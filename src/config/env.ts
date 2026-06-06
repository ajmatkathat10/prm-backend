/**
 * env.ts — Singleton environment configuration
 
 * SINGLETON PATTERN: All environment variables are read and validated
 * in exactly ONE place. Every other module imports from here — no more
 * scattered `process.env.*` calls throughout the codebase.
 
 */
import * as dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT ?? '5001', 10),
  mongodbUri: requireEnv('MONGODB_URI', 'mongodb://localhost:27017/prm'),
  jwtSecret: requireEnv('JWT_SECRET', 'jwt_secret_prm_tool_2026_super_secure'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  session: {
    cookieName: 'session',
    maxAgeMs: 1000 * 60 * 60 * 8, // 8 hours
    expiresIn: '8h',
  },
} as const;

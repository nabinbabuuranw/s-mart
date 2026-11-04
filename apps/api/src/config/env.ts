import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4100),
  DATABASE_URL: z.string().url().startsWith('postgres'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  CORS_ORIGINS: z.string().default('http://localhost:3100,http://localhost:3101'),
  UPLOAD_DIR: z.string().default('./uploads'),
  BACKUP_DIR: z.string().default('./backups'),
  PUBLIC_API_URL: z.string().default('http://localhost:4100'),
  RATE_LIMIT_GLOBAL: z.coerce.number().int().default(600),
  RATE_LIMIT_AUTH: z.coerce.number().int().default(10),
  MAX_FAILED_LOGINS: z.coerce.number().int().default(5),
  LOCKOUT_MINUTES: z.coerce.number().int().default(15),
  ESEWA_SECRET_KEY: z.string().optional(),
  KHALTI_SECRET_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  FCM_SERVICE_ACCOUNT_JSON: z.string().optional(),
});
export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const r = schema.safeParse(source);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${msg}`);
  }
  return r.data;
}
export const ENV = 'ENV_CONFIG';

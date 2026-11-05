// Runs `next build` with NODE_ENV forced to "production".
// Next.js refuses to prerender the 404 page when NODE_ENV is "development"
// (the repo's own .env sets it, and a shell that sources .env passes it on).
// Forcing it here makes the web build independent of the caller's environment.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(`${process.cwd()}/package.json`);
const nextBin = require.resolve('next/dist/bin/next');
const env = { ...process.env, NODE_ENV: 'production' };
const result = spawnSync(process.execPath, [nextBin, 'build', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  cwd: process.cwd(),
});
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);

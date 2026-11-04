import { createApp } from './app.factory';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  const app = await createApp(env);
  await app.listen(env.PORT, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`S Mart API listening on :${env.PORT} (docs: /api/docs)`);
}
bootstrap().catch((e) => { console.error(e.message ?? e); process.exit(1); });

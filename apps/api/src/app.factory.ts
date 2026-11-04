import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import { buildModule } from './app.module';
import { Env } from './config/env';

export async function createApp(env: Env): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(buildModule(env), { logger: env.NODE_ENV === 'test' ? false : ['log', 'warn', 'error'], bodyParser: true });
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((req: any, res: any, next: any) => { req.id = req.headers['x-request-id'] ?? randomUUID(); res.setHeader('X-Request-Id', req.id); next(); });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '256kb' });
  const origins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({ origin: (o, cb) => cb(null, !o || origins.includes(o)), credentials: true, allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Client', 'X-CSRF'], methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], maxAge: 600 });
  app.setGlobalPrefix('api/v1');
  if (env.NODE_ENV === 'development') { // API docs are exposed only on a developer machine, never in test or production
    const cfg = new DocumentBuilder().setTitle('S Mart API').setDescription('Shared backend for the S Mart admin site, customer site and (later) Android apps').setVersion('1.0.0').addBearerAuth().build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, cfg));
  }
  return app;
}

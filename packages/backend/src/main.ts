import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as express from 'express';

// Load backend package `.env` first (works when process.cwd() is monorepo root).
// override: true — Windows often has a stale DATABASE_URL in user/machine env;
// without override, dotenv skips keys already set and the app uses the wrong URL.
loadEnv({ path: join(__dirname, '..', '.env'), override: true });
loadEnv();
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './lib/http-exception.filter';
import { ensureSchemaPatches } from './db/schemaPatches';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const logger = new Logger('Bootstrap');

  await ensureSchemaPatches();

  const uploadLocalDir = process.env.UPLOAD_LOCAL_DIR?.trim();
  if (uploadLocalDir) {
    const staticDir = resolve(
      uploadLocalDir.startsWith('.')
        ? join(process.cwd(), uploadLocalDir)
        : uploadLocalDir,
    );
    if (!existsSync(staticDir)) mkdirSync(staticDir, { recursive: true });
    app.use('/uploads', express.static(staticDir));
    new Logger('Bootstrap').log(
      `Serving local uploads from ${staticDir} at /uploads`,
    );
  }

  // Global exception filter — consistent error response format
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Parse CORS origins from env — comma-separated list of URLs
  const rawOrigins = process.env.CORS_ORIGINS ?? '';
  const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (origin, callback) => {
      // If no CORS_ORIGINS is defined, allow all
      if (allowedOrigins.length === 0) {
        callback(null, true);
        return;
      }

      // If origin is in allowed list OR origin is missing (e.g. mobile app)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  if (allowedOrigins.length > 0) {
    logger.log(`CORS enabled for origins: ${allowedOrigins.join(', ')}`);
  } else {
    logger.log('CORS enabled for all origins (development mode)');
  }

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
  logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();

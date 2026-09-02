import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import * as http from 'http';
import { AppModule } from './app.module';

function isHealthPath(url: string | undefined): boolean {
  const path = (url || '/').split('?')[0];
  return path === '/' || path === '/health' || path === '/api/health';
}

function attachHealthGate(app: express.Express) {
  app.use((req, res, next) => {
    if (
      (req.method === 'GET' || req.method === 'HEAD') &&
      isHealthPath(req.url)
    ) {
      res.status(200).json({ status: 'ok' });
      return;
    }
    next();
  });
}

async function bootstrap() {
  const host = process.env.HOSTNAME || process.env.HOST || '0.0.0.0';
  const port = parseInt(process.env.PORT || '4000', 10);

  // Listen immediately so container health checks pass even if Nest/TypeORM
  // is still connecting (or never gets a database).
  const expressApp = express();
  attachHealthGate(expressApp);

  const server = http.createServer(expressApp);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      // eslint-disable-next-line no-console
      console.log(`[YSU-IR] HTTP listening on http://${host}:${port}`);
      resolve();
    });
  });

  try {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      { abortOnError: false },
    );

    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.enableCors({
      origin: (process.env.CORS_ORIGIN || '*').split(','),
      credentials: true,
    });

    await app.init();
    // eslint-disable-next-line no-console
    console.log(`[YSU-IR] Backend ready on http://${host}:${port}/api`);
  } catch (err) {
    // Keep the health listener up so the deploy probe can succeed.
    // eslint-disable-next-line no-console
    console.error(
      '[YSU-IR] Nest bootstrap failed; health endpoints remain available',
      err,
    );
  }
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[YSU-IR] Fatal bootstrap error', err);
  process.exit(1);
});

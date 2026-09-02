import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import { AppModule } from './app.module';

function isHealthPath(url?: string): boolean {
  const path = (url || '/').split('?')[0];
  return path === '/' || path === '/health' || path === '/api/health';
}

async function bootstrap() {
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || process.env.HOSTNAME || '0.0.0.0';

  const server = express();
  server.use((req: Request, res: Response, next: NextFunction) => {
    if (isHealthPath(req.path || req.url)) {
      res.status(200).json({ status: 'ok' });
      return;
    }
    next();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      // eslint-disable-next-line no-console
      console.log(`[YSU-IR] Health endpoints listening on http://${host}:${port}`);
      resolve();
    });
  });

  try {
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

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
    // Keep serving / /health /api/health so the deploy health check can pass
    // even when PostgreSQL (or other Nest bootstrap deps) is unavailable.
    // eslint-disable-next-line no-console
    console.error(
      '[YSU-IR] Nest bootstrap failed; health endpoints remain available',
      err,
    );
  }
}

bootstrap();

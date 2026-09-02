import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as http from 'http';
import * as net from 'net';
import { AppModule } from './app.module';
import { HealthOnlyModule } from './health-only.module';

async function isPostgresReachable(): Promise<boolean> {
  const host = process.env.DB_HOST;
  if (!host) return false;
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 1500);
    socket.once('connect', () => {
      clearTimeout(timer);
      finish(true);
    });
    socket.once('error', () => {
      clearTimeout(timer);
      finish(false);
    });
  });
}

const HEALTH_JSON = JSON.stringify({ status: 'ok' });

function isHealthPath(url?: string): boolean {
  const path = (url || '/').split('?')[0];
  return path === '/' || path === '/health' || path === '/api/health';
}

function writeHealth(res: http.ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(HEALTH_JSON);
}

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || process.env.HOSTNAME || '0.0.0.0';

  let nestHandler:
    | ((req: http.IncomingMessage, res: http.ServerResponse) => void)
    | null = null;

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && isHealthPath(req.url)) {
      writeHealth(res);
      return;
    }
    if (nestHandler) {
      nestHandler(req, res);
      return;
    }
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'starting' }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  // eslint-disable-next-line no-console
  console.log(`[YSU-IR] Listening on http://${host}:${port} (health ready)`);

  try {
    const useFullApp = await isPostgresReachable();
    const app = await NestFactory.create(
      useFullApp ? AppModule : HealthOnlyModule,
      { abortOnError: false },
    );
    app.setGlobalPrefix('api', {
      exclude: [
        { path: '/', method: RequestMethod.GET },
        { path: 'health', method: RequestMethod.GET },
        { path: 'api/health', method: RequestMethod.GET },
      ],
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.enableCors({
      origin: (process.env.CORS_ORIGIN || '*').split(','),
      credentials: true,
    });

    const expressApp = app.getHttpAdapter().getInstance();
    if (typeof expressApp?.set === 'function') {
      expressApp.set('trust proxy', 1);
    }

    await app.init();
    nestHandler = expressApp;
    // eslint-disable-next-line no-console
    console.log(`[YSU-IR] Backend listening on http://${host}:${port}/api`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      '[YSU-IR] Nest bootstrap failed; health endpoints remain available',
      err,
    );
  }
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[YSU-IR] Fatal bootstrap error; health listener should remain up', err);
});

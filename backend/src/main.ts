import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Request, type Response } from 'express';
import { AppModule } from './app.module';

function sendHealth(_req: Request, res: Response) {
  res.status(200).json({ status: 'ok' });
}

async function bootstrap() {
  const host = process.env.HOST || process.env.HOSTNAME || '0.0.0.0';
  const port = parseInt(process.env.PORT || '3000', 10);

  const server = express();
  server.get('/', sendHealth);
  server.get('/health', sendHealth);
  server.get('/api/health', sendHealth);

  await new Promise<void>((resolve, reject) => {
    const httpServer = server.listen(port, host, () => {
      // eslint-disable-next-line no-console
      console.log(`[YSU-IR] Health listener on http://${host}:${port}`);
      resolve();
    });
    httpServer.on('error', reject);
  });

  try {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(server),
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

    await app.init();
    // eslint-disable-next-line no-console
    console.log(`[YSU-IR] Backend ready on http://${host}:${port}/api`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      '[YSU-IR] Full Nest bootstrap failed; health endpoints remain up',
      err,
    );
  }
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

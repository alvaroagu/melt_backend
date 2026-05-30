import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const frontendOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const rawPort = process.env.PORT;
  const port = rawPort === undefined ? 3001 : Number(rawPort);

  if (!Number.isInteger(port) || port < 0) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  app.use(cookieParser());
  app.enableCors({
    origin:
      frontendOrigins.length <= 1
        ? (frontendOrigins[0] ?? true)
        : frontendOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.listen(port);
}
void bootstrap();

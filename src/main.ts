import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const cfg = app.get(ConfigService);

  app.enableCors({
    origin: (cfg.get<string>('CORS_ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()),
    credentials: true,
  });

  app.use(cookieParser());
  app.use(session({
    secret: cfg.get<string>('SESSION_SECRET'),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  }));

  await app.listen(cfg.get<number>('SERVER_PORT') || 4000);
}
bootstrap();

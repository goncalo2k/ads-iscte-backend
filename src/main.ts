import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const cfg = app.get(ConfigService);

  app.enableCors({
    origin: (cfg.get<string>('FRONTEND_URL') || '').split(',').map(s => s.trim()),
    credentials: true,
  });

  app.use(cookieParser());
  app.use(session({
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
    credentials: true,
    secret: cfg.get<string>('SESSION_SECRET') || 'please_change_this_secret',
  }));

  await app.listen(cfg.get<number>('SERVER_PORT') || 4000);
}
bootstrap();

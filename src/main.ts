import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const cfg = app.get(ConfigService);
  console.log('allowed origins', (cfg.get<string>('FRONTEND_URL') || '').split(',').map(s => s.trim()),);
  app.enableCors({
    origin: (origin, cb) => {
      const allowed = (cfg.get<string>('FRONTEND_URL') || '')
        .trim()
        .replace(/\/$/, ''); // remove trailing slash

      const incoming = (origin || '').replace(/\/$/, '');

      console.log('[CORS] incoming:', origin, '| allowed:', allowed);

      // allow non-browser calls (no Origin header)
      if (!origin) return cb(null, true);

      return incoming === allowed
        ? cb(null, true)
        : cb(null, false); // no ACAO header -> browser will show CORS error
    },
    credentials: true,
  });

  app.use(cookieParser());
  app.use(session({
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
    credentials: true,
    secret: cfg.get<string>('JWT_SECRET'),
  }));

  const config = new DocumentBuilder()
    .setTitle('Gitdash API')
    .setDescription('Gitdash API description')
    .setVersion('1.0')
    .addTag('gitdash')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(cfg.get<number>('SERVER_PORT') || 4000);
}
bootstrap();

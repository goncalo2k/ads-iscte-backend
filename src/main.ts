import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';



async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const cfg = app.get(ConfigService);
  const allowedOrigins = (cfg.get<string>('FRONTEND_CORS_URLS') || '').split(',').map(s => s.trim());

  console.log('allowed origins', allowedOrigins);
  app.enableCors({
    origin: allowedOrigins/* (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, origin);
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    } */,
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

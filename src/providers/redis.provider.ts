import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

export const redisProvider = {
  provide: 'REDIS',
  inject: [ConfigService],
  useFactory: (cfg: ConfigService) => {
    const url = cfg.get<string>('REDIS_URL')!;
    const isTls = url.startsWith('rediss://');

    const options: RedisOptions = {
      keepAlive: 10_000,
      connectTimeout: 10_000,

      retryStrategy: (times) => Math.min(times * 2, 2),

      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,

      ...(isTls ? { tls: { servername: new URL(url).hostname } } : {}),
    };

    const redis = new Redis(url, options);

    redis.on('error', (e) => console.error('[redis] error', e));
    redis.on('close', () => console.warn('[redis] close'));
    redis.on('reconnecting', (delay) =>
      console.warn('[redis] reconnecting in', delay, 'ms'),
    );

    return redis;
  },
};

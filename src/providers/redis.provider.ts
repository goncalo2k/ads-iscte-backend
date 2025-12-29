import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

export const redisProvider = {
  provide: 'REDIS',
  inject: [ConfigService],
  useFactory: (cfg: ConfigService) => {
    const url = cfg.get<string>('REDIS_URL');
    if (!url) throw new Error('REDIS_URL is missing');

    const parsed = new URL(url);
    const isTls = parsed.protocol === 'rediss:';

    const options: RedisOptions = {
      keepAlive: 30_000,
      connectTimeout: 10_000,

      retryStrategy: (times) => {
        return Math.min(50 * Math.pow(2, times - 1), 2000);
      },

      maxRetriesPerRequest: 3,
      enableReadyCheck: true,

      lazyConnect: false,

      ...(isTls
        ? {
            tls: {
              servername: parsed.hostname,
            },
          }
        : {}),
    };

    const redis = new Redis(url, options);

    redis.on('connect', () => console.log('[redis] connect'));
    redis.on('ready', () => console.log('[redis] ready'));
    redis.on('error', (e) => console.error('[redis] error', e));
    redis.on('close', () => console.warn('[redis] close'));
    redis.on('reconnecting', (delay) =>
      console.warn('[redis] reconnecting in', delay, 'ms'),
    );

    const pingIntervalMs = 30_000;
    const interval = setInterval(() => {
      if (redis.status === 'ready') redis.ping().catch(() => {});
    }, pingIntervalMs);

    redis.on('end', () => clearInterval(interval));

    return redis;
  },
};

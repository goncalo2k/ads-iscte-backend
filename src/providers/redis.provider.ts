import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const redisProvider = {
  provide: 'REDIS',
  inject: [ConfigService],
  useFactory: (cfg: ConfigService) => {
    const url = cfg.get<string>('REDIS_URL')!;
    return new Redis(url, { tls: url.startsWith('rediss://') ? {} : undefined });
  },
};

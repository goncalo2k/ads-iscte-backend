// src/auth/token-store.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { StoredToken } from '../../models/token-store.model';
import { redisProvider } from 'src/providers/redis.provider';

@Injectable()
export class TokenStoreService {
  private ns: string;
  private ttl: number;

  constructor(
    @Inject(redisProvider.provide) private readonly redis: Redis,
    private readonly cfg: ConfigService,
  ) {
    this.ns = this.cfg.get('REDIS_NAMESPACE') ?? 'app';
    this.ttl = parseInt(this.cfg.get('SESSION_TTL_SECONDS') ?? '1800', 10);
  }

  private kSess = (sid: string) => `${this.ns}:sess:${sid}`;
  private kState = (state: string) => `${this.ns}:oauth_state:${state}`;

  async setSession(sid: string, data: StoredToken): Promise<void> {
    await this.redis.set(this.kSess(sid), JSON.stringify(data), 'EX', this.ttl);
  }

  async getSession(sid: string): Promise<StoredToken | null> {
    const raw = await this.redis.get(this.kSess(sid));
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  };

  async delSession(sid: string): Promise<void> { await this.redis.del(this.kSess(sid)) };

  async touch(sid: string): Promise<void> { await this.redis.expire(this.kSess(sid), this.ttl); }

  async saveState(state: string): Promise<void> { await this.redis.set(this.kState(state), '1', 'EX', 600); }

  async verifyAndConsumeState(state: string): Promise<boolean> {
    try {
      const ok = await (this.redis as any).getdel?.(this.kState(state));
      if (ok) return true;
    } catch { }
    const exists = await this.redis.get(this.kState(state));
    if (!exists) return false;
    await this.redis.del(this.kState(state));
    return true;
  };
}

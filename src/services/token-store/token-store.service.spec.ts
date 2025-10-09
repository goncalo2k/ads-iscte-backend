´import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { StoredToken } from '../../models/token-store.model';

@Injectable()
export class TokenStoreService {
  constructor(
    @Inject() private readonly redis: Redis,
    private readonly cfg: ConfigService,
  ) {}
  private ns = this.cfg.get('REDIS_NAMESPACE') ?? 'app';
  private ttl = parseInt(this.cfg.get('SESSION_TTL_SECONDS') ?? '604800', 10);

  private kSess = (sid: string) => `${this.ns}:sess:${sid}`;
  private kState = (state: string) => `${this.ns}:oauth_state:${state}`;

  setSession = async (sid: string, data: StoredToken) =>
    this.redis.set(this.kSess(sid), JSON.stringify(data), 'EX', this.ttl);

  getSession = async (sid: string) => {
    const raw = await this.redis.get(this.kSess(sid));
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  };

  delSession = (sid: string) => this.redis.del(this.kSess(sid));
  touch = (sid: string) => this.redis.expire(this.kSess(sid), this.ttl);

  saveState = (state: string) => this.redis.set(this.kState(state), '1', 'EX', 600);
  verifyAndConsumeState = async (state: string) => {
    try {
      const ok = await (this.redis as any).getdel?.(this.kState(state));
      if (ok) return true;
    } catch {}
    const exists = await this.redis.get(this.kState(state));
    if (!exists) return false;
    await this.redis.del(this.kState(state));
    return true;
  };
}

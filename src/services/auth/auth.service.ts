import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Request, Response } from 'express';
import { DecodedJwt } from 'src/models/jwt.model';
import jwt from 'jsonwebtoken';
import { TokenStoreService } from '../token-store/token-store.service';
import { randomUUID } from 'crypto';
import { AuthProvider } from 'src/models/token-store.model';
import { GithubService } from '../github/github.service';
import { Cookie } from 'src/models/cookie.model';


@Injectable()
export class AuthService {
  constructor(private cfg: ConfigService, private tokenStoreService: TokenStoreService, private githubService: GithubService) { }

  getAuthorizeUrl(state: string) {
    const clientId = this.cfg.get('GITHUB_CLIENT_ID');
    const redirectUri = encodeURIComponent(this.cfg.get('GITHUB_REDIRECT_URI')!);
    const scope = encodeURIComponent(this.cfg.get('GITHUB_SCOPES') ?? 'read:user user:email');
    return `${this.cfg.get('GITHUB_LOGIN_OAUTH_URI')!}/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
  }

  async exchangeCodeForToken(code: string) {
    const clientId = this.cfg.get('GITHUB_CLIENT_ID');
    const clientSecret = this.cfg.get('GITHUB_CLIENT_SECRET');
    const { data } = await axios.post(
      `${this.cfg.get('GITHUB_LOGIN_OAUTH_URI')!}/access_token`,
      { client_id: clientId, client_secret: clientSecret, code },
      { headers: { Accept: 'application/json' } },
    );
    return { accessToken: data.access_token as string, scope: data.scope, tokenType: data.token_type };
  }

  async login(): Promise<string> {
    const state = randomUUID();
    await this.tokenStoreService.saveState(state);
    return this.getAuthorizeUrl(state);
  }

  async loginCallback(code: string, state: string): Promise<Cookie> {
    if (!(await this.tokenStoreService.verifyAndConsumeState(state))) throw new BadRequestException('Invalid state');

    const { accessToken, scope, tokenType } = await this.exchangeCodeForToken(code);
    const user = await this.githubService.getUser(accessToken);

    const sid = randomUUID();
    await this.tokenStoreService.setSession(sid, {
      provider: AuthProvider.Github,
      accessToken,
      scope,
      tokenType,
      username: user.login,
      githubId: user.id,
    });

    const appJwt = jwt.sign(
      { sid, sub: String(user.id), username: user.login },
      this.cfg.get<string>('JWT_SECRET')!,
      { expiresIn: (this.cfg.get('JWT_EXPIRES_IN') ?? '30') + 'm' },
    );

    const cookieName = this.cfg.get('COOKIE_NAME') ?? 'ghdash.sid';
    const secure = this.cfg.get('COOKIE_SECURE') === 'true';
    const sameSite = (this.cfg.get('COOKIE_SAMESITE') ?? 'lax') as 'lax' | 'strict' | 'none';
    const domain = this.cfg.get('COOKIE_DOMAIN') || undefined;

    return { cookieName, appJwt, options: { httpOnly: true, secure, sameSite, domain, maxAge: 1000 * 60 * (this.cfg.get('JWT_EXPIRES_IN') ?? 30) } } as Cookie;

  }
  async logout(req: Request, res: Response): Promise<void> {
    const cookieName = this.cfg.get('COOKIE_NAME') ?? 'ghdash.sid';
    try {
      const token = req.cookies?.[cookieName];
      if (token) {
        const payload = jwt.verify(
          token,
          this.cfg.get<string>('JWT_SECRET')!
        ) as DecodedJwt;

        if (payload?.sid) {
          await this.tokenStoreService.delSession(payload.sid);
        }
      }
    } catch {
      console.error('Error during logout - no sid found in token!');
    } finally {
      res.clearCookie(cookieName, {
        httpOnly: true,
        secure: this.cfg.get('COOKIE_SECURE') === 'true',
        sameSite: (this.cfg.get('COOKIE_SAMESITE') ?? 'lax') as any,
        domain: this.cfg.get('COOKIE_DOMAIN') || undefined,
      });
      res.status(204).send();
    }
  }
}

import { BadRequestException, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AuthService } from 'src/services/auth/auth.service';
import { TokenStoreService } from 'src/services/token-store/token-store.service';

import jwt from 'jsonwebtoken';

@Controller('/auth/github')
export class AuthController {
  constructor(private cfg: ConfigService,
    private authService: AuthService,
    private store: TokenStoreService) { }

  @Get('login')
  async login(@Res() res): Promise<void> {
    const state = randomUUID();
    await this.store.saveState(state);
    res.redirect(this.authService.getAuthorizeUrl(state));
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res): Promise<void> {
    if (!code || !state) throw new BadRequestException('Missing code/state');
    if (!(await this.store.verifyAndConsumeState(state))) throw new BadRequestException('Invalid state');

    const { accessToken, scope, tokenType } = await this.authService.exchangeCodeForToken(code);
    const user = await this.authService.getUser(accessToken);

    const sid = randomUUID();
    await this.store.setSession(sid, {
      provider: 'github',
      accessToken,
      scope,
      tokenType,
      username: user.login,
      githubId: user.id,
    });

    const appJwt = jwt.sign(
      { sid, sub: String(user.id), username: user.login },
      this.cfg.get<string>('JWT_SECRET')!,
      { expiresIn: this.cfg.get('JWT_EXPIRES_IN') ?? '7d' },
    );

    const cookieName = this.cfg.get('COOKIE_NAME') ?? 'ghdash.sid';
    const secure = this.cfg.get('COOKIE_SECURE') === 'true';
    const sameSite = (this.cfg.get('COOKIE_SAMESITE') ?? 'lax') as 'lax' | 'strict' | 'none';
    const domain = this.cfg.get('COOKIE_DOMAIN') || undefined;

    res.cookie(cookieName, appJwt, { httpOnly: true, secure, sameSite, domain, maxAge: 1000 * 60 * 60 * 24 * 7 });
    res.redirect(`${this.cfg.get('FRONTEND_URL')}/dashboard`);
  }

  @Get('auth/github/logout')
  async logout(@Res() res): Promise<void> {
    const cookieName = this.cfg.get('COOKIE_NAME') ?? 'ghdash.sid';
    // (Optional) parse JWT → sid → await this.store.delSession(sid);
    res.clearCookie(cookieName, {
      httpOnly: true,
      secure: this.cfg.get('COOKIE_SECURE') === 'true',
      sameSite: (this.cfg.get('COOKIE_SAMESITE') ?? 'lax') as any,
      domain: this.cfg.get('COOKIE_DOMAIN') || undefined,
    });
    res.status(204).send();
  }
}

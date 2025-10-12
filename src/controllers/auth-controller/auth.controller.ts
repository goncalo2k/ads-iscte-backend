import { BadRequestException, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { TokenStoreService } from 'src/services/token-store/token-store.service';
import jwt from 'jsonwebtoken';
import { GithubService } from 'src/services/github/github.service';
import { AuthService } from 'src/services/auth/auth.service';
import { AuthProvider } from 'src/models/token-store.model';

@Controller('/auth/github')
export class AuthController {
  constructor(private cfg: ConfigService,
    private authService: AuthService,
    private githubService: GithubService,
    private store: TokenStoreService) { }

  @Get('login')
  async login(@Res() res): Promise<void> {
    const redirectUrl = await this.authService.login();
    res.redirect(redirectUrl);
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res): Promise<void> {
    if (!code || !state) throw new BadRequestException('Missing code/state');
    const cookie = await this.authService.loginCallback(code, state);
    res.cookie(cookie.cookieName, cookie.appJwt, cookie.options);
    res.redirect(`${this.cfg.get('FRONTEND_URL')!}/dashboard`);
  }

  @Get('logout')
  async logout(@Req() req, @Res() res): Promise<void> {
    this.authService.logout(req, res);
  }
  
  @Get('session')
  async getSession(@Req() req, @Res() res): Promise<void> {
    res.json(await this.authService.getStatus(req));
  }
}

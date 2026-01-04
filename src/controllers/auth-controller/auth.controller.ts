import { BadRequestException, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenStoreService } from 'src/services/token-store/token-store.service';
import { GithubService } from 'src/services/github/github.service';
import { AuthService } from 'src/services/auth/auth.service';

@Controller('/auth/github')
export class AuthController {
  constructor(private cfg: ConfigService,
    private authService: AuthService
  ) { }

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
    res.status(await this.authService.logout(req, res)).send();
  }

  @Get('session')
  async getSession(@Req() req, @Res() res): Promise<void> {
    res.json(await this.authService.getStatus(req));
  }
}

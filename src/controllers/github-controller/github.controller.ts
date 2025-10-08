import { Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { JwtCookieGuard } from 'src/guards/auth.guard';
import { AuthService } from 'src/services/auth/auth.service';
import { TokenStoreService } from 'src/services/token-store/token-store.service';

@UseGuards(JwtCookieGuard)
@Controller('/github')
export class GithubController {
  constructor( private cfg: ConfigService,
    private authService: AuthService,
    private store: TokenStoreService) {}
  
  @Get('dashboard')
  async getDashboard(@Res() res): Promise<void> {
    res.json({ message: 'Welcome to the GitHub dashboard!' });
  }
}

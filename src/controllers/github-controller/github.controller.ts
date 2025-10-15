import { Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Sid } from 'src/decorators/sid.decorator';
import { JwtCookieGuard } from 'src/guards/auth.guard';
import { AuthService } from 'src/services/auth/auth.service';
import { GithubService } from 'src/services/github/github.service';
import { TokenStoreService } from 'src/services/token-store/token-store.service';

@UseGuards(JwtCookieGuard)
@Controller('/github')
export class GithubController {
  constructor(
    private store: TokenStoreService,
    private githubService: GithubService) { }

  @Get('dashboard')
  async getDashboard(@Res() res, @Sid() sid: string): Promise<void> {
    const accessToken = (await this.store.getSession(sid))?.accessToken;
    const repos = await this.githubService.getUserRepos(accessToken!);
    res.json({ repos });
  }

  @Get('dashboard/search/:searchTerm')
  async getReposBySearchTerm(@Res() res, @Sid() sid: string, @Param('searchTerm') searchTerm: string): Promise<void> {
    const accessToken = (await this.store.getSession(sid))?.accessToken;
    const repos = await this.githubService.getReposBySearchTerm(accessToken!, searchTerm);
    res.json({ repos });
  }
}

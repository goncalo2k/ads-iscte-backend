import { Controller, Get, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { Sid } from 'src/decorators/sid.decorator';
import { JwtCookieGuard } from 'src/guards/auth.guard';
import { DashboardResponse, RepositorySearchResponse, UserStatsResponse } from 'src/models/api.model';
import { GithubService } from 'src/services/github/github.service';
import { TokenStoreService } from 'src/services/token-store/token-store.service';

@UseGuards(JwtCookieGuard)
@Controller('/github')
export class GithubController {
  constructor(
    private store: TokenStoreService,
    private githubService: GithubService) { }

  @Get('dashboard')
  async getDashboard(@Sid() sid: string): Promise<DashboardResponse> {
    const session = await this.store.getSession(sid);
    if (!session) return { status: HttpStatus.UNAUTHORIZED, error: 'session not found' };
    return await this.githubService.getUserRepos(session.accessToken!);
  }

  @Get('dashboard/search/')
  async getReposBySearchTerm(@Sid() sid: string, @Query('searchTerm') searchTerm: string): Promise<DashboardResponse> {
    const session = await this.store.getSession(sid);
    if (!session) return { status: HttpStatus.UNAUTHORIZED, error: 'session not found' };
    return await this.githubService.getReposBySearchTerm(session.accessToken!, searchTerm);
  }

  @Get('dashboard/repository/:owner/:repo')
  async getRepoInfoByUrl(@Sid() sid: string, @Param('owner') owner: string, @Param('repo') repo: string): Promise<RepositorySearchResponse> {
    const session = await this.store.getSession(sid);
    if (!session) return { status: HttpStatus.UNAUTHORIZED, error: 'session not found' };
    return await this.githubService.getRepoInfo(session.accessToken!, owner + '/' + repo);
  }

  @Get('dashboard/repository/:owner/:repo/contributors/:userNodeId')
  async getUserInfoByRepo(@Sid() sid: string, @Param('owner') owner: string, @Param('repo') repo: string, @Param('userNodeId') userNodeId: string): Promise<UserStatsResponse> {
    const session = await this.store.getSession(sid);
    if (!session) return { status: HttpStatus.UNAUTHORIZED, error: 'session not found' };
    return await this.githubService.getUserDashboard(session.accessToken!, owner, repo, userNodeId);
  }
}

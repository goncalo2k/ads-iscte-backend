import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DashboardResponse, RepositorySearchResponse, UserStatsResponse } from 'src/models/api.model';
import { Repository } from 'src/models/repository.model';
import { SearchRepository } from 'src/models/search-repository.model';
import { User } from 'src/models/user.model';
import { GithubMapperService } from './github-mapper.service';
import { SearchContributor } from 'src/models/search-user.model';
import { Contributor } from 'src/models/contributor.model';
import { HISTORY_QUERY } from 'src/queries/commit-history-query';

@Injectable()
export class GithubService {
  constructor(private cfg: ConfigService, private githubMapper: GithubMapperService) { }
  async getUser(accessToken: string): Promise<User> {
    const me = await axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const emails = await axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/user/emails`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const primaryEmail = (emails.data as any[]).find(e => e.primary)?.email ?? emails.data?.[0]?.email ?? null;
    return {
      id: me.data.id,
      login: me.data.login,
      name: me.data.name,
      avatarUrl: me.data.avatar_url,
      email: primaryEmail,
    };
  }

  async getUserRepos(accessToken: string): Promise<DashboardResponse> {
    const repos = await axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/user/repos`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { per_page: 100, sort: 'updated' },
    });
    return { status: HttpStatus.OK, data: repos.data as Repository[] };
  }

  async getReposBySearchTerm(accessToken: string, searchTerm: string): Promise<DashboardResponse> {

    const isUrl = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)/i.test(searchTerm);

    if (isUrl) {
      const [, owner, repo] = searchTerm.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)/i)!;

      const response = await axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/repos/${owner}/${repo}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const searchRepos = response.data as SearchRepository;

      return { status: HttpStatus.OK, data: [this.githubMapper.mapSearchRepoToInternalDashboardRepository(searchRepos)] };
    } else {
      const response = await axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/search/repositories?q=${searchTerm}+in:name&sort=stars&order=desc&per_page=5`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const searchRepos = response.data.items as SearchRepository[];

      return { status: HttpStatus.OK, data: searchRepos.map(repo => this.githubMapper.mapSearchRepoToInternalDashboardRepository(repo)) };
    }
  }

  async getRepoInfo(accessToken: string, repo: string): Promise<RepositorySearchResponse> {
    const [repoInfoResponse, repoContributorsResponse] = await Promise.all([
      axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/repos/${repo}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/repos/${repo}/contributors`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);
    const repoInfo = repoInfoResponse.data as SearchRepository;
    const contributors = (repoContributorsResponse.data) as SearchContributor[];

    return { status: HttpStatus.OK, data: this.githubMapper.mapSearchRepoToInternalRepository(repoInfo, contributors) };
  }

  async getUserDashboard(accessToken: string, owner: string, repo: string, userNodeId: string): Promise<UserStatsResponse> {
    const [userContributionsResp, repoContributorResponse] = await Promise.all([
      this.getUserRepoContributionStats(accessToken, owner, repo, userNodeId, {}),
      axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/repos/${owner}/${repo}/contributors`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    const contributor = repoContributorResponse.data.find((contributor: SearchContributor) => contributor.node_id === userNodeId);



    return { status: HttpStatus.OK, data: this.githubMapper.mapAdditionalStatsToContributor(contributor, userContributionsResp) as Contributor };
  }

  private async getUserRepoContributionStats(
    accessToken: string,
    owner: string,
    repo: string,
    userNodeId: string,
    options?: { since?: string; until?: string; branch?: string }
  ): Promise<{ additions: number; deletions: number }> {
    const { since, until, branch } = options ?? {};

    // Build vars for the unified history query
    const qualifiedRef = branch ? `refs/heads/${branch}` : "refs/heads/ignored";
    const useBranch = Boolean(branch);

    let after: string | null = null;
    let additions = 0;
    let deletions = 0;

    for (; ;) {
      const { data } = await axios.post(
        this.cfg.get('GITHUB_GRAPHQL_URL')!,
        {
          query: HISTORY_QUERY,
          variables: { owner, repo, authorId: userNodeId, since, until, after, useBranch, qualifiedRef },
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (data.errors?.length > 0) {
        throw new Error(`History query failed: ${JSON.stringify(data.errors)}`);
      }

      const hist =
        data?.data?.repository?.ref?.target?.history ??
        data?.data?.repository?.defaultBranchRef?.target?.history;

      if (!hist) throw new Error("Commit history not found (bad branch?)");


      for (const n of hist.nodes as Array<{ additions: number; deletions: number }>) {
        additions += n.additions ?? 0;
        deletions += n.deletions ?? 0;
      }

      if (!hist.pageInfo?.hasNextPage) break;
      after = hist.pageInfo.endCursor;
    }

    return { additions, deletions };
  }
}

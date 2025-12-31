import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ContributorsResponse, DashboardResponse, RepositorySearchResponse, UserActivityResponse, UserRepositoryResponse, UserStatsResponse } from 'src/models/api.model';
import { Repository } from 'src/models/repository.model';
import { SearchRepository } from 'src/models/search-repository.model';
import { User } from 'src/models/user.model';
import { GithubMapperService } from './github-mapper.service';
import { SearchContributor } from 'src/models/search-user.model';
import { Contributor } from 'src/models/contributor.model';

import { USER_ISSUES_AND_PRS_STATS_QUERY, USER_REPO_COMMIT_HISTORY_QUERY } from 'src/queries/commit-history-query';
import { TokenStoreService } from '../token-store/token-store.service';
import { SearchActivityStats } from 'src/models/search-activity-stats.model';
import { PageEnum } from 'src/enums/page.enum';
import { GraphQLService } from '../graphql/graphql.service';
import { RepoStatsOptions, SearchStats } from 'src/models/search-stats.model';
import { SearchBasicStats, SearchBasicStatsPage } from 'src/models/search-basic-stats.model';

@Injectable()
export class GithubService {
  constructor(private cfg: ConfigService, private githubMapper: GithubMapperService, private tokenService: TokenStoreService, private graphqlService: GraphQLService) { }
  async getUser(accessToken: string): Promise<User> {
    const me = await axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, },
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

  async getUserRepos(accessToken: string): Promise<Repository[]> {
    const repos = await axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/user/repos`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { per_page: 100, sort: 'updated' },
    });

    return repos.data as Repository[];
  }

  async getUserInitialDashboard(accessToken: string): Promise<DashboardResponse> {
    const [user, repos] = await Promise.all([this.getUser(accessToken), this.getUserRepos(accessToken)]);

    return { status: HttpStatus.OK, data: { user, repos } }
  }

  async getReposBySearchTerm(accessToken: string, searchTerm: string): Promise<UserRepositoryResponse> {

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

  async getRepoContributors(accessToken: string, repo: string, page: number = 0): Promise<ContributorsResponse> {
    const response = await axios.get<SearchContributor[]>(`${this.cfg.get('GITHUB_API_BASE')!}/repos/${repo}/contributors`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { page: page, perPage: this.cfg.get('GITHUB_API_PAGE_SIZE')! }
    });

    const contributors: Contributor[] = await Promise.all(
      response.data.map(async (c) => {
        try {
          const { data: user } = await axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/users/${c.login}`, { headers: { Authorization: `Bearer ${accessToken}` } });
          return this.githubMapper.mapContributorToInternal(c, user?.name ?? null);
        } catch {
          return this.githubMapper.mapContributorToInternal(c, null);
        }
      })
    );

    const header = response.headers?.link;

    const nextPage = this.parsePageFromLink(header, PageEnum.NextPage);
    const lastPage = this.parsePageFromLink(header);

    return {
      status: HttpStatus.OK,
      data: {
        nextPage: nextPage,
        hasMore: !!nextPage && nextPage !== lastPage,
        contributors
      }
    };
  }

  async getRepoInfo(accessToken: string, repo: string): Promise<RepositorySearchResponse> {
    const [repoInfoResponse, repoContributorsResponse, firstContributorResponse, firstCommitResponse, openPRsResponse, openIssuesResponse] = await Promise.all([
      axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/repos/${repo}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      this.getRepoContributors(accessToken, repo),
      axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/repos/${repo}/contributors?per_page=1`/*TODO: Explain why no &anon=true */, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/repos/${repo}/commits?per_page=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/search/issues?q=repo:${repo}+is:pr+is:open`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/search/issues?q=repo:${repo}+type:issue+is:open`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    const repoInfo = repoInfoResponse.data as SearchRepository;
    const contributors = (repoContributorsResponse.data?.contributors) as Contributor[];

    const openPrs = openPRsResponse.data.total_count;

    const openIssues = openIssuesResponse.data.total_count;

    const totalContributors = this.getTotalContributors(firstContributorResponse.headers?.link, contributors);

    const totalCommits = this.getTotalCommits(firstCommitResponse.headers?.link);


    return { status: HttpStatus.OK, data: this.githubMapper.mapSearchRepoToInternalRepository(repoInfo, contributors, totalContributors, totalCommits, openPrs, openIssues) };
  }

  async getUserRepoStats(
    accessToken: string,
    owner: string,
    repo: string,
    userNodeId: string,
    options?: RepoStatsOptions,
  ): Promise<UserStatsResponse> {
    const { since, until } = options ?? {};

    // Resolve login once (needed for search qualifiers). You can cache this aggressively.
    const userLogin = await this.getUserLoginFromNodeId(accessToken, userNodeId);

    const { qIssuesOpened, qIssuesClosed, qPrsSubmitted, qPrsApproved } =
      this.buildIssuesAndPrsSearchQueries({ owner, repo, userLogin, since, until });

    const variables = {
      owner,
      repo,
      authorId: userNodeId,
      qIssuesOpened,
      qIssuesClosed,
      qPrsSubmitted,
      qPrsApproved,
    };

    const payload: any = await this.graphqlService.getFromGraphQL(
      accessToken,
      USER_ISSUES_AND_PRS_STATS_QUERY,
      variables,
    );

    return {
      status: HttpStatus.OK,
      data: {
        issuesOpened: payload?.issuesOpened?.issueCount ?? 0,
        issuesClosed: payload?.issuesClosed?.issueCount ?? 0,
        prsSubmitted: payload?.prsSubmitted?.issueCount ?? 0,
        prsApproved: payload?.prsApproved?.issueCount ?? 0,
      }
    };
  }

  async getUserRepoSlowStats(
    accessToken: string,
    owner: string,
    repo: string,
    userNodeId: string,
    options?: RepoStatsOptions & { maxPages?: number },
  ): Promise<UserStatsResponse> {
    let afterHistory: string | null = null;

    let additions = 0;
    let deletions = 0;

    for (; ;) {
      const pageResp = await this.getUserRepoSlowStatsPage(accessToken, owner, repo, userNodeId, {
        ...options,
        afterHistory,
      });

      additions += pageResp.additions! || 0;
      deletions += pageResp.deletions! || 0;

      if (!pageResp.hasNextPage) {
        return { status: HttpStatus.OK, data: { additions, deletions } as Partial<SearchBasicStats> };
      }
    }
  }

  async getUserActivity(accessToken: string, owner: string, repo: string, username: string): Promise<UserActivityResponse> {
    const repoActivity = this.getRepoActivity(accessToken, owner, repo);
    const userStats = (await repoActivity).find((entry) => entry.author.login === username);
    return { status: HttpStatus.OK, data: userStats }
  }

  // Private Helpers
  private async getRepoActivity(accessToken: string, owner: string, repo: string): Promise<SearchActivityStats[]> {
    let statsResponse;
    const cachedResponse = await this.tokenService.getRepoStats(owner + '/' + repo)
    if (cachedResponse) {
      statsResponse = cachedResponse;
    } else {
      statsResponse = await axios.get<SearchContributor[]>(`${this.cfg.get('GITHUB_API_BASE')!}/repos/${owner}/${repo}/stats/contributors`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      await this.tokenService.setRepoStats(owner + '/' + repo, statsResponse)
    }
    return statsResponse;
  }

  private async getUserRepoSlowStatsPage(
    accessToken: string,
    owner: string,
    repo: string,
    userNodeId: string,
    options?: RepoStatsOptions & { afterHistory?: string | null },
  ): Promise<Partial<SearchBasicStatsPage>> {
    const { since, until, branch, afterHistory } = options ?? {};

    const useBranch = Boolean(branch);
    const qualifiedRef = branch ? `refs/heads/${branch}` : 'refs/heads/ignored';

    // Note: GitTimestamp expects ISO-ish; you’re passing YYYY-MM-DD which is usually OK,
    // but you can also pass full ISO strings if you prefer.
    const fromIso = since ?? null;
    const toIso = until ?? null;

    const variables = {
      owner,
      repo,
      authorId: userNodeId,
      useBranch,
      qualifiedRef,
      afterHistory: afterHistory ?? null,
      from: fromIso,
      to: toIso,
    };

    const payload: any = await this.graphqlService.getFromGraphQL(
      accessToken,
      USER_REPO_COMMIT_HISTORY_QUERY,
      variables,
    );

    const repoNode = payload?.repository;
    const hist =
      repoNode?.ref?.target?.history ??
      repoNode?.defaultBranchRef?.target?.history ??
      null;

    let additionsDelta = 0;
    let deletionsDelta = 0;

    if (hist?.nodes?.length) {
      for (const n of hist.nodes as Array<{ additions?: number; deletions?: number }>) {
        additionsDelta += n.additions ?? 0;
        deletionsDelta += n.deletions ?? 0;
      }
    }

    return {
      additions: additionsDelta,
      deletions: deletionsDelta,
    };
  }

  private buildIssuesAndPrsSearchQueries(params: {
    owner: string;
    repo: string;
    userLogin: string;
    since?: string;
    until?: string;
  }): { qIssuesOpened: string, qIssuesClosed: string, qPrsSubmitted: string, qPrsApproved: string } {
    const { owner, repo, userLogin, since, until } = params;
    const repoFullName = `${owner}/${repo}`;
    const dateRange = this.buildDateRangeQualifier(since, until);

    const qIssuesOpened = [
      `repo:${repoFullName}`,
      `is:issue`,
      `author:${userLogin}`,
      dateRange('created'),
    ].filter(Boolean).join(' ');

    const qIssuesClosed = [
      `repo:${repoFullName}`,
      `is:issue`,
      `is:closed`,
      `closed-by:${userLogin}`,
      dateRange('closed'),
    ].filter(Boolean).join(' ');

    const qPrsSubmitted = [
      `repo:${repoFullName}`,
      `is:pr`,
      `author:${userLogin}`,
      dateRange('created'),
    ].filter(Boolean).join(' ');

    // Proxy for approvals (not perfect for strict "approvedAt"):
    const qPrsApproved = [
      `repo:${repoFullName}`,
      `is:pr`,
      `review:approved`,
      `reviewed-by:${userLogin}`,
      dateRange('updated'),
    ].filter(Boolean).join(' ');

    return { qIssuesOpened, qIssuesClosed, qPrsSubmitted, qPrsApproved };
  }

  private async getUserLoginFromNodeId(accessToken: string, userNodeId: string): Promise<string> {
    const { data } = await axios.post(
      this.cfg.get('GITHUB_GRAPHQL_URL')!,
      {
        query: `
        query($id: ID!) {
          node(id: $id) {
            ... on User { login }
          }
        }
      `,
        variables: { id: userNodeId },
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (data.errors?.length) throw new Error(`GraphQL failed: ${JSON.stringify(data.errors)}`);
    const login = data?.data?.node?.login;
    if (!login) throw new Error(`Could not resolve login from nodeId=${userNodeId}`);
    return login;
  }

  private buildDateRangeQualifier(since?: string, until?: string): (qual: string) => string {
    // GitHub search qualifiers:
    // created:YYYY-MM-DD..YYYY-MM-DD
    // closed:YYYY-MM-DD..YYYY-MM-DD
    // updated:YYYY-MM-DD..YYYY-MM-DD
    const dateRange = (qual: string) => {
      if (since && until) return `${qual}:${since}..${until}`;
      if (since && !until) return `${qual}:>=${since}`;
      if (!since && until) return `${qual}:<=${until}`;
      return '';
    };
    return dateRange;
  }

  private parsePageFromLink(linkHeader: string, pageType: PageEnum = PageEnum.LastPage): number | null {
    if (!linkHeader) return null;
    const parts = linkHeader.split(",");
    const last = parts.find(p => p.includes(pageType));
    if (!last) return null;

    const urlMatch = last.match(/<([^>]+)>/);
    if (!urlMatch) return null;

    const url = new URL(urlMatch[1]);
    const page = url.searchParams.get("page");
    return page ? Number(page) : null;
  }

  private getTotalContributors(link: string, contributors: Contributor[]): number {
    const lastPage = this.parsePageFromLink(link);
    return lastPage ??
      (Array.isArray(contributors) ? contributors.length : 0);
  }

  private getTotalCommits(link: string): number {
    const lastPage = this.parsePageFromLink(link);
    return lastPage ?? 0;
  }
}

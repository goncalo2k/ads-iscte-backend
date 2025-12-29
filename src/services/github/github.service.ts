import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ContributorsResponse, DashboardResponse, RepositorySearchResponse, UserRepositoryResponse, UserStatsResponse } from 'src/models/api.model';
import { Repository } from 'src/models/repository.model';
import { SearchRepository } from 'src/models/search-repository.model';
import { User } from 'src/models/user.model';
import { GithubMapperService } from './github-mapper.service';
import { SearchContributor } from 'src/models/search-user.model';
import { Contributor } from 'src/models/contributor.model';
import { SearchStats } from 'src/models/search-stats.model';
import { USER_REPO_STATS_QUERY } from 'src/queries/commit-history-query';

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

  async getRepoContributors(accessToken: string, repo: string, pageOffset: number = 0): Promise<ContributorsResponse> {
    const response = await axios.get<SearchContributor[]>(`${this.cfg.get('GITHUB_API_BASE')!}/repos/${repo}/contributors`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return {
      status: HttpStatus.OK,
      data:
        response.data.map((contributor: SearchContributor) => this.githubMapper.mapContributorToInternal(contributor))
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
    const contributors = (repoContributorsResponse.data) as Contributor[];

    const openPrs = openPRsResponse.data.total_count;

    const openIssues = openIssuesResponse.data.total_count;

    const totalContributors = this.getTotalContributors(firstContributorResponse.headers?.link, contributors);

    const totalCommits = this.getTotalCommits(firstCommitResponse.headers?.link);

    const contributorsWithNames = await Promise.all(
      contributors.map(async (c) => {
        try {
          const { data: user } = await axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/users/${c.userName}`, { headers: { Authorization: `Bearer ${accessToken}` } });
          return {
            ...c,
            name: user?.name ?? null,
          };
        } catch {
          return { ...c, name: null };
        }
      })
    );

    return { status: HttpStatus.OK, data: this.githubMapper.mapSearchRepoToInternalRepository(repoInfo, contributorsWithNames, totalContributors, totalCommits, openPrs, openIssues) };
  }

  async getUserDashboard(accessToken: string, owner: string, repo: string, userNodeId: string): Promise<UserStatsResponse> {
    const [userContributionsResp, repoContributorResponse] = await Promise.all([
      this.getUserRepoContributionStats(accessToken, owner, repo, userNodeId, {}), //TODO: ADD DATE WINDOW!
      axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/repos/${owner}/${repo}/contributors`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    const contributor = repoContributorResponse.data.find((contributor: SearchContributor) => contributor.node_id === userNodeId);

    return { status: HttpStatus.OK, data: this.githubMapper.mapAdditionalStatsToContributor(contributor, userContributionsResp) as Contributor };
  }

  private parseLastPageFromLink(linkHeader?: string): number | null {
    if (!linkHeader) return null;
    const parts = linkHeader.split(",");
    const last = parts.find(p => p.includes('rel="last"'));
    if (!last) return null;

    const urlMatch = last.match(/<([^>]+)>/);
    if (!urlMatch) return null;

    const url = new URL(urlMatch[1]);
    const page = url.searchParams.get("page");
    return page ? Number(page) : null;
  }

  private getTotalContributors(link: string, contributors: Contributor[]): number {
    const lastPage = this.parseLastPageFromLink(link);
    return lastPage ??
      (Array.isArray(contributors) ? contributors.length : 0);
  }

  private getTotalCommits(link: string): number {
    const lastPage = this.parseLastPageFromLink(link);
    return lastPage ?? 0;
  }


  private async getUserRepoContributionStats(
    accessToken: string,
    owner: string,
    repo: string,
    userNodeId: string,
    options?: { since?: string; until?: string; branch?: string }
  ): Promise<SearchStats> {
    const { since, until, branch } = options ?? {};
    const repoFullName = `${owner}/${repo}`;

    const useBranch = Boolean(branch);
    const qualifiedRef = branch ? `refs/heads/${branch}` : 'refs/heads/ignored';

    // If caller doesn’t pass dates, you should consider defaulting to a bounded window,
    // otherwise commit history can still be enormous.
    const fromIso = since ?? null;
    const toIso = until ?? null;

    // 1) Resolve login once (needed for search qualifiers)
    // You can also cache this (nodeId -> login) in-memory/redis for huge wins.
    const userLogin = await this.getUserLoginFromNodeId(accessToken, userNodeId);

    // 2) Build search queries (counts only, no nodes)
    const dateRange = (qual: string) => {
      if (since && until) return `${qual}:${since}..${until}`;
      if (since && !until) return `${qual}:>=${since}`;
      if (!since && until) return `${qual}:<=${until}`;
      return ''; // no date bound
    };

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

    // Note: search filters approvals via review:approved + reviewed-by:LOGIN
    // There isn’t a perfect “submittedAt” qualifier; updated is commonly used as a proxy.
    const qPrsApproved = [
      `repo:${repoFullName}`,
      `is:pr`,
      `review:approved`,
      `reviewed-by:${userLogin}`,
      dateRange('updated'),
    ].filter(Boolean).join(' ');

    // 3) Now only paginate commit history
    let afterHistory: string | null = null;

    let additions = 0;
    let deletions = 0;

    let issuesOpened = 0;
    let issuesClosed = 0;
    let prsSubmitted = 0;
    let prsApproved = 0;
    let userName = '';

    for (; ;) {
      const { data } = await axios.post(
        this.cfg.get('GITHUB_GRAPHQL_URL')!,
        {
          query: USER_REPO_STATS_QUERY,
          variables: {
            owner,
            repo,
            authorId: userNodeId,
            qIssuesOpened,
            qIssuesClosed,
            qPrsSubmitted,
            qPrsApproved,
            useBranch,
            qualifiedRef,
            afterHistory,
            from: fromIso,
            to: toIso,
          },
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (data.errors?.length) {
        throw new Error(`GraphQL failed: ${JSON.stringify(data.errors)}`);
      }

      const payload = data?.data;

      // Set once (counts won’t change between pages; but safe to assign each loop)
      userName = payload?.node?.name ?? userName;
      issuesOpened = payload?.issuesOpened?.issueCount ?? issuesOpened;
      issuesClosed = payload?.issuesClosed?.issueCount ?? issuesClosed;
      prsSubmitted = payload?.prsSubmitted?.issueCount ?? prsSubmitted;
      prsApproved = payload?.prsApproved?.issueCount ?? prsApproved;

      const repoNode = payload?.repository;
      const hist =
        repoNode?.ref?.target?.history ??
        repoNode?.defaultBranchRef?.target?.history ??
        null;

      if (hist?.nodes?.length) {
        for (const n of hist.nodes as Array<{ additions?: number; deletions?: number }>) {
          additions += n.additions ?? 0;
          deletions += n.deletions ?? 0;
        }
      }

      const hasNext = Boolean(hist?.pageInfo?.hasNextPage);
      if (!hasNext) break;
      afterHistory = hist.pageInfo.endCursor;
    }

    return { additions, deletions, issuesOpened, issuesClosed, prsSubmitted, prsApproved, userName } as SearchStats;
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

}

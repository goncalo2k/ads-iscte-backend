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
import { USER_REPO_ACTIVITY_AND_HISTORY_QUERY } from 'src/queries/commit-history-query';
import { SearchStats } from 'src/models/search-stats.model';

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
      this.getUserRepoContributionStats(accessToken, owner, repo, userNodeId, {}), //TODO: ADD DATE WINDOW!
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
  ): Promise<SearchStats> {
    const { since, until, branch } = options ?? {};
    const repoFullName = `${owner}/${repo}`;

    // Branch selection (history)
    const qualifiedRef = branch ? `refs/heads/${branch}` : 'refs/heads/ignored';
    const useBranch = Boolean(branch);

    // Cursors for the three connections we paginate
    let afterHistory: string | null = null;
    let afterClosedIssues: string | null = null;
    let afterReviews: string | null = null;

    // Accumulators
    let additions = 0;
    let deletions = 0;
    let issuesOpened = 0;
    let issuesClosed = 0;
    let prsSubmitted = 0;
    let prsApproved = 0;

    // Helper: window check
    const within = (iso?: string | null) =>
      !!iso &&
      (!since || iso >= since) &&
      (!until || iso <= until!);

    for (; ;) {
      const { data } = await axios.post(
        this.cfg.get('GITHUB_GRAPHQL_URL')!,
        {
          query: USER_REPO_ACTIVITY_AND_HISTORY_QUERY,
          variables: {
            owner,
            repo,
            authorId: userNodeId,
            from: since ?? null,
            to: until ?? null,
            afterHistory,
            afterClosedIssues,
            afterReviews,
            useBranch,
            qualifiedRef,
          },
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (data.errors?.length) {
        throw new Error(`GraphQL failed: ${JSON.stringify(data.errors)}`);
      }

      const repoNode = data?.data?.repository;
      const userNode = data?.data?.node;

      // A) Commit history → additions/deletions
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

      // B) Issues closed by the user (ClosedEvent.actor)
      const closedIssuesConn = repoNode?.closedIssues;
      if (closedIssuesConn?.nodes?.length) {
        for (const issue of closedIssuesConn.nodes as Array<{
          closedAt?: string | null;
          timelineItems?: {
            nodes?: Array<{
              __typename?: string;
              createdAt?: string;
              actor?: { __typename?: string; id?: string | null } | null;
            }>;
          };
        }>) {
          const events = issue.timelineItems?.nodes ?? [];
          const closedByUser = events.some(
            (ev) =>
              ev?.__typename === 'ClosedEvent' &&
              ev?.actor?.__typename === 'User' &&
              ev?.actor?.id === userNodeId
          );

          // You can use issue.closedAt or ClosedEvent.createdAt for the window; closedAt is fine.
          if (closedByUser && within(issue.closedAt)) {
            issuesClosed += 1;
          }
        }
      }

      // C) User contributions window → issues opened, PRs submitted, PR reviews (approved)
      const cc = userNode?.contributionsCollection;

      // Issues opened (repo bucket)
      if (cc?.issueContributionsByRepository?.length) {
        const bucket = cc.issueContributionsByRepository.find(
          (b: any) => b.repository?.nameWithOwner === repoFullName
        );
        if (bucket?.contributions?.totalCount) {
          issuesOpened = bucket.contributions.totalCount;
        }
      }

      // PRs submitted (opened)
      if (cc?.pullRequestContributionsByRepository?.length) {
        const bucket = cc.pullRequestContributionsByRepository.find(
          (b: any) => b.repository?.nameWithOwner === repoFullName
        );
        if (bucket?.contributions?.totalCount) {
          prsSubmitted = bucket.contributions.totalCount;
        }
      }

      // PR reviews → count APPROVED in repo & within window
      const reviewBuckets = cc?.pullRequestReviewContributionsByRepository ?? [];
      const repoReviewBucket = reviewBuckets.find(
        (b: any) => b.repository?.nameWithOwner === repoFullName
      );
      const reviewNodes =
        repoReviewBucket?.contributions?.nodes as
        | Array<{
          pullRequestReview?: {
            state?: string;
            submittedAt?: string;
            pullRequest?: { repository?: { nameWithOwner?: string } };
          } | null;
        }>
        | undefined;

      if (reviewNodes?.length) {
        for (const n of reviewNodes) {
          const r = n?.pullRequestReview;
          if (!r) continue;
          if (
            r.state === 'APPROVED' &&
            r.pullRequest?.repository?.nameWithOwner === repoFullName &&
            within(r.submittedAt ?? null)
          ) {
            prsApproved += 1;
          }
        }
      }

      // Advance cursors
      const histHasNext = Boolean(hist?.pageInfo?.hasNextPage);
      if (histHasNext) afterHistory = hist!.pageInfo!.endCursor;

      const issuesHasNext = Boolean(closedIssuesConn?.pageInfo?.hasNextPage);
      if (issuesHasNext) afterClosedIssues = closedIssuesConn!.pageInfo!.endCursor;

      const reviewsHasNext = Boolean(repoReviewBucket?.contributions?.pageInfo?.hasNextPage);
      if (reviewsHasNext) afterReviews = repoReviewBucket!.contributions!.pageInfo!.endCursor;

      // Stop when all drained
      if (!histHasNext && !issuesHasNext && !reviewsHasNext) break;
    }

    return { additions, deletions, issuesOpened, issuesClosed, prsSubmitted, prsApproved } as SearchStats;
  }

}

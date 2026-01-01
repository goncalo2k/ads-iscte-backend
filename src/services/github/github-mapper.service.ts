import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contributor } from 'src/models/contributor.model';
import { Repository } from 'src/models/repository.model';
import { SearchRepository } from 'src/models/search-repository.model';
import { SearchBasicStats } from 'src/models/search-basic-stats.model';
import { SearchContributor } from 'src/models/search-user.model';
import { SearchActivityStats } from 'src/models/search-activity-stats.model';
import { ActivityStats } from 'src/models/activity-stats.model';

@Injectable()
export class GithubMapperService {
  mapSearchRepoToInternalRepository(searchRepo: SearchRepository, contributors: Contributor[], totalContributors: number, totalCommits: number, openPrs: number, openIssues: number): Repository {
    return {
      id: searchRepo.id,
      name: searchRepo.name,
      full_name: searchRepo.full_name,
      private: searchRepo.private,
      html_url: searchRepo.html_url,
      description: searchRepo.description,
      updated_at: searchRepo.updated_at,
      size: searchRepo.size,
      language: searchRepo.language,
      fork: searchRepo.fork,
      url: searchRepo.url,
      forks_count: searchRepo.forks_count,
      stargazers_count: searchRepo.stargazers_count,
      watchers_count: searchRepo.watchers_count,
      open_issues: openIssues,
      open_prs: openPrs,
      contributors: contributors,
      contributors_count: totalContributors,
      commit_count: totalCommits
    };
  }

  mapSearchRepoToInternalDashboardRepository(searchRepo: SearchRepository): Repository {
    return {
      id: searchRepo.id,
      name: searchRepo.name,
      full_name: searchRepo.full_name,
      private: searchRepo.private,
      html_url: searchRepo.html_url,
      updated_at: searchRepo.updated_at,
      size: searchRepo.size,
      language: searchRepo.language,
      stargazers_count: searchRepo.stargazers_count,
      open_issues: searchRepo.open_issues,
    };
  }

  mapContributorToInternal(contributor: SearchContributor, name: string | null = null): Contributor {
    return {
      id: contributor.id,
      node_id: contributor.node_id,
      userName: contributor.login,
      avatarUrl: contributor.avatar_url,
      name: name ?? undefined,
      contributions: contributor.contributions,
    }
  }

  mapAdditionalStatsToContributor(userContributionsResp: SearchBasicStats, node_id: string): Partial<Contributor> {
    return {
      node_id: node_id,
      name: userContributionsResp.userName,
      additions: userContributionsResp.additions,
      deletions: userContributionsResp.deletions,
    } as Partial<Contributor>;
  }

  mapSearchActivityStatsToActivityStats(searchStats: SearchActivityStats): ActivityStats {
    return {
      total: searchStats.total,
      weeks: searchStats.weeks,
      author: this.mapContributorToInternal(searchStats.author)
    }
  }
}

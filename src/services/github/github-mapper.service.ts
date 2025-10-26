import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contributor } from 'src/models/contributor.model';
import { Repository } from 'src/models/repository.model';
import { SearchRepository } from 'src/models/search-repository.model';
import { SearchStats } from 'src/models/search-stats.model';
import { SearchContributor } from 'src/models/search-user.model';

@Injectable()
export class GithubMapperService {
  constructor() { }

  mapGitRepoToInternal(repo: any): Repository {
    return {
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      html_url: repo.html_url,
      description: repo.description,
      fork: repo.fork,
      url: repo.url,
      forks_count: repo.forks_count,
      stargazers_count: repo.stargazers_count,
      watchers_count: repo.watchers_count,
    };
  }

  mapSearchRepoToInternalRepository(searchRepo: SearchRepository, contributors: SearchContributor[]): Repository {
    return {
      id: searchRepo.id,
      name: searchRepo.name,
      full_name: searchRepo.full_name,
      private: searchRepo.private,
      html_url: searchRepo.html_url,
      description: searchRepo.description,
      fork: searchRepo.fork,
      url: searchRepo.url,
      forks_count: searchRepo.forks_count,
      stargazers_count: searchRepo.stargazers_count,
      watchers_count: searchRepo.watchers_count,
      contributors: contributors.map(contributor => this.mapContributorToInternal(contributor)),
    };
  }

  mapSearchRepoToInternalDashboardRepository(searchRepo: SearchRepository): Repository {
    return {
      id: searchRepo.id,
      name: searchRepo.name,
      full_name: searchRepo.full_name,
      private: searchRepo.private,
      html_url: searchRepo.html_url,
    };
  }

  mapContributorToInternal(contributor: SearchContributor): Contributor {
    return {
      id: contributor.id,
      node_id: contributor.node_id,
      name: contributor.login,
      contributions: contributor.contributions,
    }
  }

  mapAdditionalStatsToContributor(contributor: SearchContributor, userContributionsResp: SearchStats
  ): Contributor {
    return {
      ...this.mapContributorToInternal(contributor),
      additions: userContributionsResp.additions,
      deletions: userContributionsResp.deletions,
      issuesOpened: userContributionsResp.issuesOpened,
      issuesClosed: userContributionsResp.issuesClosed,
      prsSubmitted: userContributionsResp.prsSubmitted,
      prsApproved: userContributionsResp.prsApproved,
    };
  }
}

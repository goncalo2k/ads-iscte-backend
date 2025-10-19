import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DashboardResponse } from 'src/models/api.model';
import { Repository } from 'src/models/repository.model';
import { SearchRepository } from 'src/models/search-repository.model';
import { User } from 'src/models/user.model';

@Injectable()
export class GithubMapperService {
  constructor(private cfg: ConfigService) {}

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

  mapSearchRepoToInternalRepository(searchRepo: SearchRepository): Repository {
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
    };
  }
}

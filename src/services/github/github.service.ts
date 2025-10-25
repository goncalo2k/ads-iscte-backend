import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DashboardResponse } from 'src/models/api.model';
import { Repository } from 'src/models/repository.model';
import { SearchRepository } from 'src/models/search-repository.model';
import { User } from 'src/models/user.model';
import { GithubMapperService } from './github-mapper.service';

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
    return { ok: true, data: repos.data as Repository[] };
  }

  async getReposBySearchTerm(accessToken: string, searchTerm: string): Promise<DashboardResponse> {

    const isUrl = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)/i.test(searchTerm);

    if (isUrl) {
      const [, owner, repo] = searchTerm.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)/i)!;

      const response = await axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/repos/${owner}/${repo}`);

      const searchRepos = response.data as SearchRepository;
      
      return { ok: true, data: [this.githubMapper.mapSearchRepoToInternalRepository(searchRepos)] };
    } else {
      const response = await axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/search/repositories?q=${searchTerm}+in:name&sort=stars&order=desc&per_page=5`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const searchRepos = response.data.items as SearchRepository[];

      return { ok: true, data: searchRepos.map(repo => this.githubMapper.mapSearchRepoToInternalRepository(repo)) };
    }
  }

  async getRepoInfo(accessToken: string, repo: string): Promise<Repository> {
    return {} as Repository;
  }
}

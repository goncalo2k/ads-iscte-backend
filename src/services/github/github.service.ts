import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DashboardResponse } from 'src/models/api.model';
import { Repository } from 'src/models/repository.model';
import { User } from 'src/models/user.model';

@Injectable()
export class GithubService {
  constructor(private cfg: ConfigService) { }
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
    const repos = await axios.get(`${this.cfg.get('GITHUB_API_BASE')!}/search/repositories?q=${searchTerm}+in:name&sort=stars&order=desc&per_page=5`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { ok: true, data: repos.data as Repository[] };
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AuthService {
  constructor(private cfg: ConfigService) { }

  getAuthorizeUrl(state: string) {
    const clientId = this.cfg.get('GITHUB_CLIENT_ID');
    const redirectUri = encodeURIComponent(this.cfg.get('GITHUB_REDIRECT_URI')!);
    const scope = encodeURIComponent(this.cfg.get('GITHUB_SCOPES') ?? 'read:user user:email');
    return `${this.cfg.get('GITHUB_LOGIN_OAUTH_URI')!}/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
  }

  async exchangeCodeForToken(code: string) {
    const clientId = this.cfg.get('GITHUB_CLIENT_ID');
    const clientSecret = this.cfg.get('GITHUB_CLIENT_SECRET');
    const { data } = await axios.post(
      `${this.cfg.get('GITHUB_LOGIN_OAUTH_URI')!}/access_token`,
      { client_id: clientId, client_secret: clientSecret, code },
      { headers: { Accept: 'application/json' } },
    );
    return { accessToken: data.access_token as string, scope: data.scope, tokenType: data.token_type };
  }
}

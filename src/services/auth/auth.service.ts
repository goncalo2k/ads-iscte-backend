import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AuthService {
  constructor(private cfg: ConfigService) {}

  getAuthorizeUrl(state: string) {
    const clientId = this.cfg.get('GITHUB_CLIENT_ID');
    const redirectUri = encodeURIComponent(this.cfg.get('GITHUB_REDIRECT_URI')!);
    console.log('Redirect URI:', this.cfg.get('GITHUB_REDIRECT_URI'));
    console.log('Encoded Redirect URI:', redirectUri);
    const scope = encodeURIComponent(this.cfg.get('GITHUB_SCOPES') ?? 'read:user user:email');
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
  }

  async exchangeCodeForToken(code: string) {
    const clientId = this.cfg.get('GITHUB_CLIENT_ID');
    const clientSecret = this.cfg.get('GITHUB_CLIENT_SECRET');
    const { data } = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: clientId, client_secret: clientSecret, code },
      { headers: { Accept: 'application/json' } },
    );
    return { accessToken: data.access_token as string, scope: data.scope, tokenType: data.token_type };
  }

  async getUser(accessToken: string) {
    const me = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const emails = await axios.get('https://api.github.com/user/emails', {
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
}

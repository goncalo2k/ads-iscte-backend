export type StoredToken = {
  provider: AuthProvider.Github;
  accessToken: string;
  scope?: string;
  tokenType?: string;
  username: string;
  githubId: number;
};

export enum AuthProvider {
  Github = 'github',
}
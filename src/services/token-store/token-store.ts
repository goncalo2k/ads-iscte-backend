export type StoredToken = {
  provider: 'github';
  accessToken: string;
  scope?: string;
  tokenType?: string;
  username: string;
  githubId: number;
};

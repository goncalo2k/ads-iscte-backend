import { Repository } from "./repository.model";

export interface DashboardResponse extends ApiResponse<Repository[]> { }

export interface RepoistorySearchResponse extends ApiResponse<Repository> { }

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
import { HttpStatus } from "@nestjs/common";
import { Repository } from "./repository.model";
import { Contributor } from "./contributor.model";
import { User } from "./user.model";

export interface DashboardResponse extends ApiResponse<{user: User, repos: Repository[]}> { }

export interface SessionStatusResponse extends ApiResponse<{user: Partial<User>, expirationTime: number}> { }

export interface UserRepositoryResponse extends ApiResponse<Repository[]> { }

export interface RepositorySearchResponse extends ApiResponse<Repository> { }

export interface UserStatsResponse extends ApiResponse<Contributor> { }

export interface ApiResponse<T> {
  status?: HttpStatus;
  data?: T;
  error?: string;
}
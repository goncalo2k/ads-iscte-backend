import { HttpStatus } from "@nestjs/common";
import { Repository } from "./repository.model";
import { Contributor } from "./contributor.model";
import { User } from "./user.model";
import { SearchActivityStats } from "./search-activity-stats.model";
import { ActivityStats } from "./activity-stats.model";
import { PrConversionStats } from "./pr-conversion-stats.model";

export interface DashboardResponse extends ApiResponse<{ user: User, repos: Repository[] }> { }

export interface SessionStatusResponse extends ApiResponse<{ user: Partial<User>, expirationTime: number }> { }

export interface UserRepositoryResponse extends ApiResponse<Repository[]> { }

export interface RepositorySearchResponse extends ApiResponse<Repository> { }

export interface UserStatsResponse extends ApiResponse<Partial<Contributor>> { }

export interface UserActivityResponse extends ApiResponse<ActivityStats> { }

export interface UserPrConversionResponse extends ApiResponse<PrConversionStats> { }

export interface ContributorsResponse extends ApiResponse<{ nextPage: number | null, hasMore: boolean, contributors: Contributor[] }> { }

export interface ApiResponse<T> {
  status?: HttpStatus;
  data?: T;
  error?: string;
}
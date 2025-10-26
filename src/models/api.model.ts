import { HttpStatus } from "@nestjs/common";
import { Repository } from "./repository.model";
import { Contributor } from "./contributor.model";

export interface DashboardResponse extends ApiResponse<Repository[]> { }

export interface RepositorySearchResponse extends ApiResponse<Repository> { }

export interface UserStatsResponse extends ApiResponse<Contributor> { }

export interface ApiResponse<T> {
  status?: HttpStatus;
  data?: T;
  error?: string;
}
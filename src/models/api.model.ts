import { HttpStatus } from "@nestjs/common";
import { Repository } from "./repository.model";

export interface DashboardResponse extends ApiResponse<Repository[]> { }

export interface RepoistorySearchResponse extends ApiResponse<Repository> { }

export interface ApiResponse<T> {
  status?: HttpStatus;
  data?: T;
  error?: string;
}
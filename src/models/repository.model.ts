import { Contributor } from "./contributor.model";

export interface Repository {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    language: string;
    size: number;
    updated_at: string
    html_url?: string;
    description?: string | null;
    fork?: boolean;
    url?: string;
    forks_count?: number;
    stargazers_count?: number;
    watchers_count?: number;
    contributors_count?: number;
    contributors?: Contributor[];
}
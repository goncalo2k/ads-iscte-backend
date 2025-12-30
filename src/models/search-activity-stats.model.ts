import { SearchContributor } from "./search-user.model";

export interface SearchActivityStats {
    total: number;
    weeks: SearchWeeklyActivity[];
    author: SearchContributor;
};

export interface SearchWeeklyActivity {
    w: number,
    a: number,
    d: number,
    c: number
}
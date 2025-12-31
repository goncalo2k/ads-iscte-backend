import { SearchBasicStats } from "./search-basic-stats.model";
import { SearchStats } from "./search-stats.model";

export interface Contributor extends SearchBasicStats, SearchStats {
    id: number;
    node_id?: string;
    name?: string;
    avatarUrl: string;
    contributions: number;
}